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
	'FINANCING': '融资中',
	'COMPLETE': '融资完成',
	'FOLLOWING': '跟踪',
	'ABUNDANT': '终止'
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
		pcnt: 0,
		gcnt: 0,
		mcnt: 0
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

	var rating_int = parseInt(t.get('rating'));
	if (!rating_int || rating_int < 0) {
		rating_int = 0;
	}
	var star = "";
	for (var i = 0; i < rating_int; i++) {
		star += '<span class="glyphicon glyphicon-star"></span>';
	}
	for (var i = 0; i < 5-rating_int; i++) {
		star += '<span class="glyphicon glyphicon-star-empty"></span>';
	}
	return {
		id: t.id,
		name: nnStr(t.get('name')),
		introdution: nnStr(t.get('introdution')),
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
		createdAt: formatTime(t.createdAt),
		createdAtLong: formatTimeLong(t.createdAt),
		createdAtUnix: moment(t.createdAt).valueOf()
	};
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
		query.equalTo('rating', parseInt(rating));
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
	
	var query = new AV.Query('Project');
	query.ascending('status');
	query.descending('createdAt');
	query.equalTo('group', AV.User.current());
	if (type) {
		query.equalTo('type', type);
	}
	if (status) {
		query.equalTo('status', status);
	}
	if (rating) {
		query.equalTo('rating', parseInt(rating));
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
		}
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
		req.body.status, req.body.rating, req.body.invest_money, req.body.contact_way, function (project) {
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

function createProject(res, client, attachmentFile, name, introdution, type, status, rating, invest_money, contact_way, then) {
	var project = new AV.Object('Project');

	project.set('creator', AV.User.current());
	project.set('name', name);
	project.set('introdution', introdution);
	project.set('type', type);
	project.set('status', status);
	project.set('rating', parseInt(rating));
	project.set('invest_money', invest_money);
	project.set('contact_way', contact_way);
	project.set('create_time', new Date());

	project.save().then(function (project) {
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
	}, renderErrorFn(res));
}

function updateProject(res, project, attachmentFile, name, introdution, type, status, rating, invest_money, contact_way, then) {
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
			var relation = project.relation("attachments");
            project = transformProject(project);
			if (project.creatorId != cid) {
				res.redirect("/projects/"+projectId+"/comments");
				return;
			}
			relation.query().find({
				success: function(attachs){
					res.render('edit', { 
						project: project, 
						token: token, 
						cid: cid,
						isAdmin: isAdmin,
						attachs: attachs
					});
				}
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
				req.body.status, req.body.rating, req.body.invest_money, req.body.contact_way, function (project) {
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
                project = transformProject(project);
                comments = _.map(comments, transformComment);
				relation.query().find({
					success: function(attachs){
						res.render('item', { 
							project: project, 
							isAdmin: isAdmin,
							token: token, 
							comments: comments,
							cid: cid,
							attachs: attachs
						});
					}
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
	query.count().then(function(count){
		var pageCount = (count%limit==0) ? (count/limit) : ((count-count%limit)/limit + 1);
		if (page > pageCount) {
			page = pageCount;
		}
		var skip = (page - 1) * limit;
		query.limit(limit);
		query.skip(skip);

		query.find().then(function(results) {
			var userIds = [];
			for (var i = 0, len = results.length; i < len; i++) {
				userIds[i] = results[i].get('follower').id;
			}

			var q = new AV.Query(AV.User);
			q.containedIn("objectId", userIds);
			q.find().then(function(users) {
				var subf = " in (select follower from _Follower where user=pointer('_User', ?)) ";
				// 好友发起项目查询
				AV.Query.doCloudQuery("select * from Project where creator " + subf, [cid]).then(function(result){
					var cps = result.results;
					// 好友邀请我参与项目查询
					AV.Query.doCloudQuery("select * from Project where group in (select * from _User where objectId=?) and creator " + subf, [cid, cid]).then(function(result){
						var mps = result.results;
						users = _.map(users, transformUser);
						users = countUp(users, cps, mps);
						// 参加项目查询
						gcnt(users, users.length-1, function() {
							res.render('contact', {
								users: users, 
								page: page,
								pageCount: pageCount,
								isAdmin: isAdmin,
								client: client
							});
						});
					},mutil.renderErrorFn(res));
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
					users = countUp1(users, cps);
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

function countUp(users, cps, mps) {
	if(cps){
		for (var i = 0, li = cps.length; i < li; i++) {
			var cp = cps[i];
			for (var j = 0, lj = users.length; j < lj; j++) {
				var user = users[j];
				if (user.id == cp.get('creator').id) {
					user.ccnt++;
					if (cp.get('status')=='COMPLETE') {
						user.pcnt++;
					}
				}
			}
		}
	}
	if(mps){
		for (var i = 0, li = mps.length; i < li; i++) {
			var mp = mps[i];
			for (var j = 0, lj = users.length; j < lj; j++) {
				var user = users[j];
				if (user.id == mp.get('creator').id) {
					user.mcnt++;
				}
			}
		}
	}

	return users;
}

function countUp1(users, cps) {
	if(cps){
		for (var i = 0, li = cps.length; i < li; i++) {
			var cp = cps[i];
			for (var j = 0, lj = users.length; j < lj; j++) {
				var user = users[j];
				if (user.id == cp.get('creator').id) {
					user.ccnt++;
					if (cp.get('status')=='COMPLETE') {
						user.pcnt++;
					}
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
	query.get(cid, {
		success : function(user) {
			user = transformUser(user);
			AV.Query.doCloudQuery("select count(*), * from Project where creator=pointer('_User', ?)", [cid], {
				success: function(result){
					var crs = _.map(result.results, transformProject);
					user.ccnt = result.count; // 发起项目数量

					for (var i = 0; i < user.ccnt; i++) {
						var p = crs[i];
						if (p.rawStatus == "COMPLETE") {
							user.pcnt++; // 完成融资项目数量
						}
					}

					AV.Query.doCloudQuery("select count(*), * from Project where group in (select * from _User where objectId=?)", [cid], {
						success: function(result){
							var grs = _.map(result.results, transformProject);
							user.gcnt = result.count; // 参与项目数量

							res.render('me', {user: user, crs: crs, grs: grs, isAdmin: isAdmin});
						}
					});
				}
			});
		}
	});
});

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
            //mlog.log(projectJson);
            var sid = projectJson.sid;
            projects = projectJson.results || [];
            projects = projects.splice(skip);
            projects = _.map(projects, transformSearchProject);
			//renderError(res, tickets);
            var prevPage, nextPage;
            if (page > 1) {
                prevPage = page - 1;
            } else {
                prevPage = 1;
            }
            nextPage = page + 1;
            res.render('search', {isAdmin: isAdmin, projects: projects, content:content, searchPage:true,
				page: page, prevPage: prevPage, nextPage: nextPage});
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

