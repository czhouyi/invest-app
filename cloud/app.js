// 在 Cloud code 里初始化 Express 框架
var express = require('express');
var app = express();
var Mailgun = require('mailgun').Mailgun;
var util = require('util');
var expressLayouts = require('express-ejs-layouts');
var moment = require('moment');
var _ = require('underscore');
var fs = require('fs');
var avosExpressHttpsRedirect = require('avos-express-https-redirect');
var crypto = require('crypto');
var avosExpressCookieSession = require('avos-express-cookie-session');

//var admin = require('cloud/madmin.js');
var login = require('cloud/login.js');
//var mticket = require('cloud/mticket.js');
var mlog = require('cloud/mlog.js');
var muser = require('cloud/muser.js');
var mutil = require('cloud/mutil.js');
var config = require('cloud/config.js');
var _s = require('underscore.string');

// App 全局配置
app.set('views','cloud/views');   // 设置模板目录
app.set('view engine', 'ejs');    // 设置 template 引擎
app.use(express.bodyParser());    // 读取请求 body 的中间件
app.use(avosExpressHttpsRedirect());
app.use(express.cookieParser(config.cookieParserSalt));
app.use(avosExpressCookieSession({
	cookie: {
		maxAge: 3600000
	},
	fetchUser: true
}));
app.use(expressLayouts);
app.use(login.clientTokenParser());
app.use(app.router);


var Project = AV.Object.extend('Project');
var Attach = AV.Object.extend("Attach");
var Follower = AV.Object.extend("_Follower");
var Followee = AV.Object.extend("_Followee");
var limit = 10;
var type2showMap = {
	'EBUSINESS': '电商',
	'SERVICE': '企业服务',
	'ENTERTAINMENT': '文化体育娱乐',
	'O2O': 'O2O',
	'FINANCIAL': '金融',
	'SOCIAL': '社交网络',
	'GAME': '游戏',
	'EDUCATION': '教育',
	'TOOL': '工具软件',
	'HARDWARE': '智能硬件',
	'TRAVEL': '旅游',
	'CAR': '汽车&交通',
	'HEALTH': '医疗健康',
	'MEDIA': '媒体',
	'ESTATE': '房产服务',
	'FOOD': '餐饮',
	'BIGDATA': '大数据',
	'EXTRA': '其他'
};

var status2showMap = {
	'FINANCING': '融资开放',
	'COMPLETE': '融资完成',
	'FOLLOWING': '后续跟踪',
	'DISCARD': '放弃中止'
};
var renderError = mutil.renderError;
var renderErrorFn = mutil.renderErrorFn;
var renderForbidden = mlog.renderForbidden;
var renderInfo = mutil.renderInfo;

function is_admin(req) {
	return req.admin;
}

function formatTime(t) {
	var date = moment(t).fromNow();
	var cleanDate = '<span class="form-cell-date">' + moment(t).format('YYYY-MM-DD') + '</span> <span class="form-cell-time">' + moment(t).format('HH:mm:ss') + '</span>';
	return date;
}

function formatTimeLong(t) {
	var date = moment(t).format('YYYY-MM-DD');
	return date;
}

function nnStr(obj) {
	return obj ? obj : '';
}

function transformUser(t) {
	return {
		id: t.id,
		username: nnStr(t.get('username')),
		email: nnStr(t.get('email')),
		school: nnStr(t.get('school')),
		phone: nnStr(t.get('phone')),
		work: nnStr(t.get('work')),
		avatar: t.get('avatar') ? t.get('avatar').url() : '',
		realName: nnStr(t.get('realName')),
		company: nnStr(t.get('company')),
		ccnt: 0,
		gcnt: 0
	};
}

function transformProject(t) {
	var rawType = t.get('type');
	var type = type2showMap[rawType];
	if (type === undefined) {
		type = '未知';
	}
	var rawStatus = t.get('status');
	var status = status2showMap[rawStatus];
	if (status === undefined) {
		status = '未知';
	}

	var star = "";
	var rating = t.get('rating');
	if (rating==null) {
		star = "判断保留";
	} else {
		var rating_int = parseInt(rating);
		for (var i = 0; i < rating_int; i++) {
			star += '<span class="glyphicon glyphicon-star"></span>';
		}
		for (var i = 0; i < 5-rating_int; i++) {
			star += '<span class="glyphicon glyphicon-star-empty"></span>';
		}
	}
	var return_val, return_rate;
	if (t.get('invest_eval') && t.get('final_eval') && t.get('invest_eval') > 0) {
		return_rate = Math.round(t.get('final_eval')*100.0/t.get('invest_eval'))/100;
	}
	if (return_rate && t.get('invest')) {
		return_val = Math.round(t.get('invest') * t.get('final_eval')*1.0/t.get('invest_eval'));
	}
	return {
		id: t.id,
		name: nnStr(t.get('name')),
		introdution: nnStr(t.get('introdution')),
		jintiao: nnStr(t.get('jintiao')),
		type: type,
		rawType: rawType,
		creatorId: t.get('creator').id,
		creator: t.get('creator').get('realName'),
		status: status,
		rawStatus: rawStatus,
		rating: nnStr(t.get('rating')),
		star: star,
		invest_money: nnStr(t.get('invest_money')),
		contact_way: nnStr(t.get('contact_way')),
		invest: nnStr(t.get('invest')),
		invest_eval: nnStr(t.get('invest_eval')),
		final_eval: nnStr(t.get('final_eval')),
		return_val: return_val ? return_val : '',
		return_rate: return_rate ? return_rate : '',
		createdAt: formatTime(t.createdAt),
		createdAtLong: formatTimeLong(t.createdAt),
		createdAtUnix: moment(t.createdAt).valueOf()
	};
}

function evalProject(project, projectEval) {
	if (projectEval) {
		project.set('status', projectEval.get('status'));
		project.set('rating', projectEval.get('rating'));
		project.set('jintiao', projectEval.get('jintiao'));
		project.set('contact_way', projectEval.get('contact'));
		project.set('invest', projectEval.get('invest'));
		project.set('invest_eval', projectEval.get('invest_eval'));
		project.set('final_eval', projectEval.get('final_eval'));
	} else {
		project.set('status', 'FINANCING');
	}
	return project;
}

function transformSearchProject(t) {
    return {
        id: t.objectId,
        tid: t.id,
        project_id: t.id,
        name: t.name,
        type: type2showMap[t.type],
        createdAt: moment(t.createdAt).format('YYYY-MM-DD'),
        createdAtUnix: moment(t.createdAt).valueOf()
    };
}

function transformComment(t) {
    var fromuser = t.get('fromuser');
	var touser = t.get('touser');
    return {
        id: t.id,
        content: nnStr(t.get('content')),
        fromuser: fromuser ? fromuser.get('realName') : '',
		fromid: fromuser ? fromuser.id : '',
		touser: touser ? touser.get('realName') : '',
		toid: touser ? touser.id : '',
        createdAt: moment(t.createdAt).fromNow(),
        createdAtLong: moment(t.createdAt).format('YYYY-MM-DD')
    };
}

function saveFileThen(req, f) {
	if (req.files == null) {
		f();
		return;
	}
	var attachmentFile = req.files.attachment;
			var attach = new Attach();
			attach.set("file", attachmentFile);
			attach.set("name", attachmentFile.name);
			attach.save();
	/*if (attachmentFile && attachmentFile.name !== '') {
		fs.readFile(attachmentFile.path, function (err, data) {
			if (err) {
				return f();
			}
			//var base64Data = data.toString('base64');
			var attach = new Attach();
			attach.set("file", data);
			attach.set("name", attachmentFile.name);
			attach.save().then(function (attach) {
				f(attach);
			}, function (err) {
				f();
			});
		});
	} else {
		f();
	}*/
}

app.get('/projects', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
	var type = req.query.type;
	var status = req.query.status;
	var rating = req.query.rating;
	var token = req.token;
	var page = parseInt(req.query.page);
	if (!page) {
		page = 1;
	}
	if (page < 1) {
		page = 1;
	}
	var cid = AV.User.current().id;
	var query = new AV.Query('Project');
	query.ascending('status');
	query.descending('createdAt');
	query.equalTo('creator', AV.User.current());
	if (type) {
		query.equalTo('type', type);
	}
	if (status) {
		query.equalTo('status', status);
	}
	if (rating) {
		var rat = parseInt(rating);
		if (rat == -1) {
			query.equalTo('rating', null);
		} else {
			query.equalTo('rating', rat);
		}
	}
	query.count({
		success: function(count) {
			var pageCount = (count%limit==0) ? (count/limit) : ((count-count%limit)/limit + 1);
			if (page > pageCount) {
				page = pageCount;
			}
			var skip = (page - 1) * limit;
			query.limit(limit);
			query.skip(skip);
			
			query.find().then(function(projects) {
				projects = projects || [];
				var pequery = new AV.Query('ProjectEval');
				pequery.matchesQuery("project", query);
				pequery.find().then(function(pes) {
					projects = combinProjects(projects, pes, cid);
					projects = _.map(projects, transformProject);
					res.render('list', {
						projects: projects,
						page: page,
						pageCount: pageCount,
						type: type,
						status: status,
						rating: rating,
						isAdmin: isAdmin,
						token: token
					});
				});
			}, mutil.renderErrorFn(res));
		}
	});
});

app.get('/projects/follow', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
	var type = req.query.type;
	var status = req.query.status;
	var rating = req.query.rating;
	var token = req.token;
	var page = parseInt(req.query.page);
	if (!page) {
		page = 1;
	}
	if (page < 1) {
		page = 1;
	}
	var cuser = AV.User.current();
	var cid = cuser.id;
	var query = new AV.Query('Project');
	query.ascending('status');
	query.descending('createdAt');
	query.equalTo('group', cuser);
	query.notEqualTo('creator', cuser);
	if (type) {
		query.equalTo('type', type);
	}
	if (status) {
		query.equalTo('status', status);
	}
	
	if (rating) {
		var rat = parseInt(rating);
		if (rat == -1) {
			query.equalTo('rating', null);
		} else {
			query.equalTo('rating', rat);
		}
	}
	query.count().then(function(count) {
		var pageCount = (count%limit==0) ? (count/limit) : ((count-count%limit)/limit + 1);
		if (page > pageCount) {
			page = pageCount;
		}
		var skip = (page - 1) * limit;
		query.limit(limit);
		query.skip(skip);
			
		query.find().then(function(projects) {
			projects = projects || [];
			var pequery = new AV.Query('ProjectEval');
			pequery.matchesQuery("project", query);
			pequery.find().then(function(pes) {
				projects = combinProjects(projects, pes, cid);
				projects = _.map(projects, transformProject);
				res.render('follow', {
					projects: projects,
					page: page,
					pageCount: pageCount,
					type: type,
					status: status,
					rating: rating,
					isAdmin: isAdmin,
					token: token
				});
			}, mutil.renderErrorFn(res));
		});
	});
});

app.post('/projects', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var token = req.token;
	var cid = req.cid;
	var client = req.client;
	mlog.log('req name : ' + req.body.name);
	var attachmentFile = req.files.attachment;
	createProject(res, client, attachmentFile, req.body.name, req.body.introdution, req.body.type,
		req.body.status, req.body.rating, req.body.invest_money, req.body.contact_way, req.body.jintiao, function (project) {
		res.redirect('/projects');
	});
});

function saveAttach(attachmentFile, f) {
	var attach = new Attach();
	fs.readFile(attachmentFile.path, function (err, data) {
		var theFile = new AV.File(attachmentFile.name, data);	
		attach.set("file", theFile);
		attach.set("name", attachmentFile.name);
		attach.save().then(function(attach) {
			f(attach);
		});
	});
}

function createProject(res, client, attachmentFile, name, introdution, type, status, rating, invest_money, contact_way, jintiao, then) {
	var project = new AV.Object('Project');

	project.set('creator', AV.User.current());
	project.set('name', name);
	project.set('introdution', introdution);
	project.set('type', type);
	project.set('status', status);
	project.set('rating', parseInt(rating));
	project.set('invest_money', invest_money);
	project.set('contact_way', contact_way);
	project.set('jintiao', jintiao);
	project.set('create_time', new Date());

	project.save().then(function (project) {
		var projectEval = new AV.Object('ProjectEval');

		projectEval.set('status', status);
		projectEval.set('contact', contact_way);
		projectEval.set('rating', parseInt(rating));
		projectEval.set('jintiao', jintiao);
		projectEval.save().then(function(projectEval) {
			if (typeof(attachmentFile.path) == "string") {
				saveAttach(attachmentFile, function(attach) {
					var relation = project.relation("attachments");
					relation.add(attach);
					project.save();
				});
			} else {
				for (var i = 0, len = attachmentFile.length; i < len; i++) {
					saveAttach(attachmentFile[i], function(attach){
						var relation = project.relation("attachments");
						relation.add(attach);
						project.save();
					});
				}
			}
			then();
		});
	}, renderErrorFn(res));
}

function updateProject(res, project, attachmentFile, name, introdution, type, status, 
		rating, invest_money, contact_way, jintiao, invest, invest_eval, final_eval, then) {
	//project.set('creator', AV.User.current());
	project.set('name', name);
	project.set('introdution', introdution);
	project.set('type', type);
	project.set('status', status);
	project.set('rating', parseInt(rating));
	project.set('invest_money', invest_money);
	project.set('contact_way', contact_way);
	//project.set('create_time', new Date());

	project.save().then(function (project) {
		var peq = new AV.Query('ProjectEval');
		peq.equalTo('project', AV.Object.createWithoutData('Project', project.id));
		peq.equalTo('user', AV.User.current());
		peq.find().then(function (projectEvals) {
			var projectEval;
			if (projectEvals && projectEvals.length > 0) {
				projectEval = projectEvals[0];
			} else {
				projectEval = new AV.Object('ProjectEval');
			}
			projectEval.set('status', status);
			projectEval.set('contact', contact_way);
			projectEval.set('rating', parseInt(rating));
			projectEval.set('jintiao', jintiao);
			projectEval.set('invest', invest ? parseInt(invest) : null);
			projectEval.set('invest_eval', invest_eval ? parseInt(invest_eval) : null);
			projectEval.set('final_eval', final_eval ? parseInt(final_eval): null);
			projectEval.save().then(function (projectEval) {
				if (typeof(attachmentFile.path) == "string") {
					saveAttach(attachmentFile, function(attach) {
						var relation = project.relation("attachments");
						relation.add(attach);
						project.save();
					});
				} else {
					for (var i = 0, len = attachmentFile.length; i < len; i++) {
						saveAttach(attachmentFile[i], function(attach){
							var relation = project.relation("attachments");
							relation.add(attach);
							project.save();
						});
					}
				}
				then();
			});
		});
	}, renderErrorFn(res));
}

function isProjectEmpty(project) {
    return !project || project.get('name') == null;
}

app.get('/projects/edit/:id', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
    var projectId = req.params.id;
    var token = req.token;
    var cid = req.cid;
	var query = new AV.Query('Project');
	query.equalTo('objectId', projectId);
	query.include('creator');
    query.find().then(function (projects) {
		if (projects && projects.length > 0) {
			var project = projects[0];
			var peq = new AV.Query('ProjectEval');
			peq.equalTo('project', AV.Object.createWithoutData('Project', projectId));
			peq.equalTo('user', AV.User.current());
			peq.find().then(function(pes) {
				var projectEval;
				if (pes) {
					projectEval = pes[0];
				}
				project = evalProject(project, projectEval);
				var relation = project.relation("attachments");
				project = transformProject(project);
				if (project.creatorId != cid) {
					res.redirect("/projects/"+projectId+"/comments");
					return;
				}
				relation.query().find().then(function(attachs){
					res.render('edit', { 
						project: project, 
						token: token, 
						cid: cid,
						isAdmin: isAdmin,
						attachs: attachs
					});
				});
			});
        } else {
            renderError(res, '找不到项目，该项目可能已经被删除');
        }
    }, renderErrorFn(res));
});

app.post('/projects/:id', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var token = req.token;
	var projectId = req.params.id;
	var cid = req.cid;
	var client = req.client;
	mlog.log('req name : ' + req.body.name);
	var attachmentFile = req.files.attachment;
	
	var query = new AV.Query('Project');
	query.equalTo('objectId', projectId);
	query.include('creator');
    query.find().then(function (projects) {
		if (projects && projects.length > 0) {
			var project = projects[0];
			if (project.get('creator').id != cid) {
				res.redirect("/projects/"+projectId+"/comments");
				return;
			}
			updateProject(res, project, attachmentFile, req.body.name, req.body.introdution, req.body.type,
				req.body.status, req.body.rating, req.body.invest_money, req.body.contact_way, req.body.jintiao, 
				req.body.invest, req.body.invest_eval, req.body.final_eval, function (project) {
				res.redirect('/projects');
			});
		} else {
			renderError(res, '找不到项目，该项目可能已经被删除');
		}
	}, renderErrorFn(res));
});

app.post('/attach/delete', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var token = req.token;
	var attachId = req.params.id;
	var cid = req.cid;
	var client = req.client;
	var pid = req.body.pid;
	var aid = req.body.aid;

	var project = AV.Object.createWithoutData('Project', pid);
	project.fetch().then(function (project) {
		if (isProjectEmpty(project) == false) {
			if (project.get('creator').id != cid) {
				res.redirect("/projects/"+project.id+"/comments");
				return;
			}
			var relation = project.relation("attachments");
			var attach = AV.Object.createWithoutData('Attach', aid);
			relation.remove(attach);
			project.save();
			
			res.redirect("/projects/"+project.id);
		} else {
			renderError(res, '找不到附件对应的项目，该项目可能已经被删除');
		}
	}, renderErrorFn(res));
});

app.post('/projects/delete/:id', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var token = req.token;
	var projectId = req.params.id;
	var cid = req.cid;
	var client = req.client;

	var project = AV.Object.createWithoutData('Project', projectId);
    var query = new AV.Query('Comment');
    query.ascending('createdAt');
    query.equalTo('project', project);
    query.find().then(function (comments) {
		AV.Object.destroyAll(comments);
		project.fetch().then(function (project) {
			if (isProjectEmpty(project) == false) {
				var relation = project.relation("attachments");
				relation.query().find().then(function(list){
					AV.Object.destroyAll(list);
					project.destroy().then(function(project){
						res.redirect('/projects');		
					});
				});
				res.redirect("/projects/"+project.id);
			} else {
				renderError(res, '找不到该项目，该项目可能已经被删除');
			}
		}, renderErrorFn(res));
	});
});

app.get('/projects/:id/comments', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
    var projectId = req.params.id;
    var token = req.token;
    var cid = req.cid;
    var query = new AV.Query('Comment');
    query.ascending('createdAt');
    query.equalTo('project', AV.Object.createWithoutData('Project', projectId));
	query.include("fromuser");
	query.include("touser");
    query.find().then(function (comments) {
		var pq = new AV.Query('Project');
		pq.equalTo('objectId', projectId);
		pq.include('creator');
        pq.find().then(function (projects) {
			if (projects && projects.length > 0) {
				var project = projects[0];
				var relation = project.relation("attachments");
                comments = _.map(comments, transformComment);
				relation.query().find().then(function(attachs){
					var grouprelation = project.relation("group");
					grouprelation.query().find().then(function(groups){
						var peq = new AV.Query('ProjectEval');
						peq.equalTo('project', AV.Object.createWithoutData('Project', projectId));
						peq.equalTo('user', AV.User.current());
						peq.find().then(function(pes) {
							var projectEval;
							if (pes && pes.length > 0) {
								projectEval = pes[0];
							}
							project = evalProject(project, projectEval);
							project = transformProject(project);
							// 找到合伙人
							if (projectEval) {
								var rel_group = projectEval.relation("group");
								rel_group.query().find().then(function(users){
									var parterner = '';
									for (var i = 0; i < users.length; i++){
										if (parterner) {
											parterner += '、'+users[i].get('realName');
										} else {
											parterner += users[i].get('realName');
										}
									}
									project.parterner = parterner;
									res.render('item', { 
										project: project, 
										isAdmin: isAdmin,
										token: token, 
										comments: comments,
										cid: cid,
										attachs: attachs,
										groups: groups
									});
								});
							} else {
								res.render('item', { 
									project: project, 
									isAdmin: isAdmin,
									token: token, 
									comments: comments,
									cid: cid,
									attachs: attachs,
									groups: groups
								});
							}
						});
					});
				});
            } else {
                renderError(res, '找不到项目，该项目可能已经被删除');
            }
        }, renderErrorFn(res));
    }, renderErrorFn(res));
});

app.post('/projects/:id/comments', function (req, res) {
    var cid = req.cid;
    var client = req.client;
    var token = req.token;
    var projectId = req.params.id;
    var project = AV.Object.createWithoutData('Project', projectId);
    project.fetch().then(function (project) {
        if (isProjectEmpty(project) == false) {
            var comment = new AV.Object('Comment');
            comment.set('project', AV.Object.createWithoutData('Project', projectId));
            comment.set('fromuser', AV.User.current());
            var content = req.body.content;
            comment.set('content', content);
            comment.save().then(function () {
				res.redirect('/projects/' + projectId + '/comments');
            }, renderErrorFn(res));
        } else {
            renderError(res, '找不到项目');
        }
    }, renderErrorFn(res));
});

app.get('/projects/new', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
	var token = req.token;
	var client = req.client;
	res.render('new', {
		token: token,
		isAdmin: isAdmin,
		client: client
	});
});

app.get('/', function (req, res) {
	res.redirect('/projects');
});

app.get('/contact', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
	var cid = req.cid;
	var client = req.client;
	var page = parseInt(req.query.page);
	if (!page) {
		page = 1;
	}
	if (page < 1) {
		page = 1;
	}

	var query = new AV.Query(Follower);
	query.equalTo("user", AV.User.current());
	query.ascending("createdAt");
	query.find().then(function(followers){
		
		var query1 = new AV.Query(Followee);
		query1.equalTo("user", AV.User.current());
		query1.ascending("createdAt");
		query1.find().then(function(followees) {
			var userIds = [];
			for (var i = 0, len = followers.length; i < len; i++) {
				userIds[i] = followers[i].get('follower').id;
			}
			for (var i = 0, len = followees.length; i < len; i++) {
				userIds[i+followers.length] = followees[i].get('followee').id;
			}

			var q = new AV.Query(AV.User);
			q.containedIn("objectId", userIds);
			q.find().then(function(users) {
				var includeIds = "'"+userIds.join("','")+"'";
				// 好友发起项目查询
				var sql = "select * from Project where creator in (select * from _User where objectId in ("+includeIds+"))";
				AV.Query.doCloudQuery(sql).then(function(result){
					var cps = result.results;
					
					users = _.map(users, transformUser);
					users = countUp(users, cps);
					// 好友参与项目查询
					gcnt(users, users.length-1, function() {
						res.render('contact', {
							users: users, 
							page: page,
							isAdmin: isAdmin,
							client: client
						});
					});
				}, mutil.renderErrorFn(res));
			}, mutil.renderErrorFn(res));
		}, mutil.renderErrorFn(res));
	}, mutil.renderErrorFn(res));
});

app.get('/users', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
	if (!isAdmin) {
		res.redirect('/contact');
		return;
	}
	var cid = req.cid;
	var client = req.client;
	var page = parseInt(req.query.page);
	if (!page) {
		page = 1;
	}
	if (page < 1) {
		page = 1;
	}

	var query = new AV.Query(AV.User);
	query.count({
		success: function(count) {
			var pageCount = (count%limit==0) ? (count/limit) : ((count-count%limit)/limit + 1);
			if (page > pageCount) {
				page = pageCount;
			}
			var skip = (page - 1) * limit;
			query.limit(limit);
			query.skip(skip);

			query.find().then(function(users) {
				var userIds = [];
				for (var i = 0, len = users.length; i < len; i++) {
					userIds[i] = users[i].id;
				}

				// 发起项目查询
				var createq = new AV.Query(Project);
				createq.matchesQuery("creator", query);
				createq.find().then(function(cps){
					users = _.map(users, transformUser);
					users = countUp(users, cps);
					// 参加项目查询
					gcnt(users, users.length-1, function() {
						res.render('user', {
							users: users, 
							page: page,
							pageCount: pageCount,
							isAdmin: isAdmin,
							client: client
						});
					});
				}, mutil.renderErrorFn(res));
			}, mutil.renderErrorFn(res));
		}
	});
});

function countUp(users, cps) {
	if(cps){
		for (var i = 0, li = cps.length; i < li; i++) {
			var cp = cps[i];
			for (var j = 0, lj = users.length; j < lj; j++) {
				var user = users[j];
				if (user.id == cp.get('creator').id) {
					user.ccnt++;
				}
			}
		}
	}

	return users;
}

function gcnt(users, index, f) {
	var cql = "select count(*) from Project where group in (select * from _User where objectId=?)";
	AV.Query.doCloudQuery(cql, [users[index].id]).then(function(result) {
		users[index].gcnt = result.count;
		if (index > 0) {
			gcnt(users, index - 1, f);
		} else {
			f();
		}
	});
}

app.get('/contact/me', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
	var client = req.client;
	var query = new AV.Query(AV.User);
	var cid = req.cid;
	query.get(cid).then(function(user) {
		user = transformUser(user);
		AV.Query.doCloudQuery("select count(*), * from Project where creator=pointer('_User', ?)", [cid]).then(function(cpresult){
			AV.Query.doCloudQuery("select * from ProjectEval where project in (select * from Project where creator=pointer('_User', ?))", [cid, cid]).then(function(cperesult){
				var crs = _.map(combinProjects(cpresult.results, cperesult.results, cid), transformProject);
				user.ccnt = cpresult.count; // 发起项目数量

				AV.Query.doCloudQuery("select count(*), * from Project where group in (select * from _User where objectId=?)", [cid]).then(function(gpresult){
					AV.Query.doCloudQuery("select * from ProjectEval where project in (select * from Project where group in (select * from _User where objectId=?))", [cid]).then(function(gperesult){
						var grs = _.map(combinProjects(gpresult.results, gperesult.results, cid), transformProject);
						user.gcnt = gpresult.count; // 参与项目数量

						res.render('me', {user: user, crs: crs, grs: grs, isAdmin: isAdmin});
					});
				});
			});
		});
	});
});

function combinProjects(ps, pes, cid) {
	for (var i = 0; i < ps.length; i++) {
		ps[i].set('status', 'FINANCING');
		for (var j = 0; j < pes.length; j++) {
			if (ps[i].id==pes[j].get('project').id && pes[j].get('user').id==cid) {
				ps[i].set('status', pes[j].get('status'));
				ps[i].set('rating', pes[j].get('rating'));
			}
		}
	}
	return ps;
}

app.get('/contact/profile/:uid', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
	var uid = req.params.uid;
	var client = req.client;
	var query = new AV.Query(AV.User);
	var cid = req.cid;
	if (uid == cid) {
		res.redirect('/contact/me');
		return;
	}
	query.get(uid, {
		success : function(user) {
			user = transformUser(user);
			AV.Query.doCloudQuery("select count(*), * from Project where creator=pointer('_User', ?)", [uid], {
				success: function(result){
					var crs = result.results;
					user.ccnt = result.count; // 发起项目数量

					var mrs = []; // 邀请我参与项目集合

					for (var i = 0; i < user.ccnt; i++) {
						var p = crs[i];
						if (p.get('status') == "COMPLETE") {
							user.pcnt++; // 完成融资项目数量
						}
					}

					AV.Query.doCloudQuery("select count(*) from Project where group in (select * from _User where objectId=?)", [uid], {
						success: function(result){
							var grs = result.results;
							user.gcnt = result.count; // 参与项目数量

							AV.Query.doCloudQuery("select count(*), * from Project where creator=pointer('_User', ?) and group in (select * from _User where objectId=?)", [uid, cid], {
								success: function(result){
									var mrs = result.results; // 邀请我参加项目集合
									mrs = _.map(mrs, transformProject);
									user.mcnt = result.count; // 邀请我参与项目数量

									res.render('profile', {user: user, mrs: mrs, isAdmin: isAdmin});
								}
							});
						}
					});
				}
			});
		}
	});
});

app.get('/users/edit/:id', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
	if (!isAdmin) {
		res.redirect('/contact');
		return;
	}
    var uid = req.params.id;
    var token = req.token;
    var cid = req.cid;
	var query = new AV.Query(AV.User);
    query.get(uid).then(function (user) {
		user = transformUser(user);
		if (user) {
			res.render('user_edit', { 
				user: user, 
				token: token, 
				cid: cid,
				isAdmin: isAdmin
			});
        } else {
            renderError(res, '找不到用户，该用户可能已经被删除');
        }
    }, renderErrorFn(res));
});

app.post('/users/edit/:id', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
	if (!isAdmin) {
		res.redirect('/contact');
		return;
	}
    var uid = req.params.id;
    var token = req.token;
    var cid = req.cid;
	var query = new AV.Query(AV.User);
    query.get(uid).then(function (user) {
		if (user) {
			updateUser(res, user, req.body.username, req.body.realName, req.body.phone,
				req.body.email, req.body.school, req.body.company, req.body.work, function (user) {
				res.redirect('/users');
			});
		} else {
			renderError(res, '找不到用户，该用户可能已经被删除');
		}
	}, renderErrorFn(res));
});

function updateUser(res, user, username, realName, phone, email, school, company, work, then) {
	user.set('username', username);
	user.set('realName', realName);
	user.set('phone', phone);
	user.set('email', email);
	user.set('school', school);
	user.set('company', company);
	user.set('work', work);

	user.save().then(function (user) {
		then();
	}, renderErrorFn(res));
}

app.post('/users/delete/:uid', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
	if (!isAdmin) {
		res.redirect('/contact');
		return;
	}
	var uid = req.params.uid;
	var client = req.client;
	var query = new AV.Query(AV.User);
	var cid = req.cid;
	
	AV.Query.doCloudQuery("select * from Comment where project in (select * from Project where creator=pointer('_User', ?))", [uid]).then(function(resultComment) {
		AV.Object.destroyAll(resultComment.results);
		AV.Query.doCloudQuery("select * from Project where creator=pointer('_User', ?)", [uid]).then(function(resultProject) {
			AV.Object.destroyAll(resultProject.results);
			query.get(uid).then(function (user) {
				if (user) {
					user.destroy().then(function(user){
				
					}, renderErrorFn(res));
				} else {
					renderError(res, '找不到用户，该用户可能已经被删除');
				}
			}, renderErrorFn(res));

		});
	}, renderErrorFn(res));
});

app.get('/search', function (req, res) {
	if (!login.isLogin(req)) {
		res.redirect('/login');
		return;
	}
	var isAdmin = is_admin(req);
    var content = req.query.content;
    if (content == null || content == '') {
        res.redirect('/search?content=AVObject&page=1');
        return;
    }
    var page = req.query.page;
    if (!page) {
        page = '1';
        res.redirect('search?content=' + encodeURI(content) + '&page=1');
        return;
    }
    page = parseInt(page);
    if (page < 1) page = 1;
    var skip = (page - 1) * 10;
    var total = skip + 10;
    mlog.log('c=' + content);
    var searchContent = content;
    mlog.log('c=' + searchContent);
    AV.Cloud.httpRequest({
        url: 'https://cn.avoscloud.com/1.1/search/select?limit=' + total + '&clazz=Project&q=' + encodeURI(searchContent),
        headers: {
            'Content-Type': 'application/json',
            'X-AVOSCloud-Application-Id': config.applicationId,
            'X-AVOSCloud-Application-Key': config.applicationKey
        },
        success: function (httpResponse) {
            var resText = httpResponse.text;
			var projectJson = JSON.parse(resText);
			var sid = projectJson.sid;
	        allprojects = projectJson.results || [];
            //mlog.log(projectJson);
			var user = AV.User.current();
			var sql = "select * from Project where creator in (select * from _User where objectId=?) or group in (select * from _User where objectId=?)";
			AV.Query.doCloudQuery(sql, [user.id, user.id]).then(function(result){
				var scope = result.results;
				var pid = [];
				for (var i = 0; i< scope.length; i++) {
					pid[i] = scope[i].id;
				}
				
				var projects = [];
				for (var i = 0, j = 0; i< allprojects.length; i++) {
					if (pid.indexOf(allprojects[i].objectId) != -1) {
						projects[j] = allprojects[i];
						j++;
					}
				}
		        projects = projects.splice(skip);
			    projects = _.map(projects, transformSearchProject);
		        var prevPage, nextPage;
			    if (page > 1) {
				    prevPage = page - 1;
				} else {
					prevPage = 1;
	            }
		        nextPage = page + 1;
			    res.render('search', {isAdmin: isAdmin, projects: projects, content:content, searchPage:true,
					page: page, prevPage: prevPage, nextPage: nextPage});
			}, mutil.renderErrorFn(res));

        },
        error: function (httpResponse) {
            renderError(res, 'Search error.' + httpResponse);
            console.error('Request failed with response code ' + httpResponse.text);
        }
    });
});

app.get('/google', function (req, res) {
    var content = req.query.content;
    res.redirect('https://www.google.com.hk/search?q=site%3Ahttps%3A%2F%2Finvest.avosapps.com+' + content);
});

app.get('/login', function (req, res) {
	if (login.isLogin(req)) {
		res.redirect('/projects');
	} else {
		res.render('login.ejs', {layout: "nohead.ejs", error: '', isAdmin: is_admin(req)});
	}
});

app.get('/download', function (req, res) {
	res.render('download.ejs', {layout: false});
});

/*app.post('/register', function (req, res) {
	var username = req.body.username;
	var password = req.body.password;
	var email = req.body.email;
	var realName = req.body.realName;
	var school = req.body.school;
	var phone = req.body.phone;
	var company = req.body.company;
	var work = req.body.work;
	if (username && password && email) {
		var user = new AV.User();
		user.set('username', username);
		user.set('password', password);
		user.set('email', email);
		user.set('realName', realName);
		user.set('school', school);
		user.set('phone', phone);
		user.set('company', company);
		user.set('work', work);
		user.signUp(null).then(function (user) {
			login.renderEmailVerify(res, email);
		}, function (error) {
			renderInfo(res, util.inspect(error));
		});
	} else {
		mutil.renderError(res, '不能为空');
	}
});*/

app.post('/login', function (req, res) {
	var username = req.body.username;
	var password = req.body.password;
	AV.User.logIn(username, password, {
		success: function (user) {
			res.redirect('/projects');
		},
		error: function (user, error) {
			error.message = '用户名密码不正确';
			res.render('login.ejs', {layout: "nohead.ejs", error: error.message, isAdmin: is_admin(req)});
			//mutil.renderError(res, error.message);
		}
	});
});

/*app.get('/register', function (req, res) {
	if (login.isLogin(req)) {
		res.redirect('/projects');
	} else {
		res.render('register.ejs',{isAdmin: is_admin(req)});
	}
});*/

app.get('/logout', function (req, res) {
	AV.User.logOut();
	res.redirect('/projects');
});

app.get('/requestEmailVerify', function (req, res) {
	var email = req.query.email;
	AV.User.requestEmailVerfiy(email).then(function () {
		mutil.renderInfo(res, '邮件已发送请查收。');
	}, mutil.renderErrorFn(res));
});

// 最后，必须有这行代码来使 express 响应 HTTP 请求
app.listen({"static": {maxAge: 604800000}});

