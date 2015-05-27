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
var type2showMap = {
	'O2O': 'O2O',
	'EDUCATION': '教育',
	'EXTRA': '其他',
	'EBUSINESS': '电商',
	'SOCIAL': '社交'
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

function formatTime(t) {
	var date = moment(t).fromNow();
	var cleanDate = '<span class="form-cell-date">' + moment(t).format('YYYY-MM-DD') + '</span> <span class="form-cell-time">' + moment(t).format('HH:mm:ss') + '</span>';
	return date;
}

function formatTimeLong(t) {
	var date = moment(t).format('YYYY-MM-DD HH:mm:ss');
	return date;
}

function transformUser(t) {
	return {
		id: t.id,
		username: t.get('username'),
		email: t.get('email')==undefined ? '' : t.get('email'),
		school: t.get('school'),
		phone: t.get('phone'),
		work: t.get('work'),
		avatar: t.get('avatar') ? t.get('avatar').url() : '',
		realName: t.get('realName'),
		company: t.get('company'),
		ccnt: 0,
		pcnt: 0,
		gcnt: 0,
		mcnt: 0
	};
}

function transformProject(t) {
	var type = type2showMap[t.get('type')];
	if (type === undefined) {
		type = '未知';
	}
	var rawStatus = t.get('status');
	var status = status2showMap[rawStatus];
	if (status === undefined) {
		status = '未知';
	}

	var rating_int = parseInt(t.get('rating'));
	var star = "";
	for (var i = 0; i < rating_int; i++) {
		star += '<span class="glyphicon glyphicon-star"></span>';
	}
	for (var i = 0; i < 5-rating_int; i++) {
		star += '<span class="glyphicon glyphicon-star-empty"></span>';
	}
	return {
		id: t.id,
		name: t.get('name'),
		introdution: t.get('introdution'),
		type: type,
		creatorId: t.get('creator').id,
		creator: t.get('creator').get('realName'),
		status: status,
		rawStatus: rawStatus,
		rating: t.get('rating'),
		star: star,
		invest_money: t.get('invest_money'),
		contact_way: t.get('contact_way'),
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
        createdAt: moment(t.createdAt).format('YYYY-MM-DD HH:mm:ss'),
        createdAtUnix: moment(t.createdAt).valueOf()
    };
}

function transformComment(t) {
    var fromuser = t.get('fromuser');
	var touser = t.get('touser');
    return {
        id: t.id,
        content: t.get('content'),
        fromuser: fromuser ? fromuser.get('username') : '',
		fromid: fromuser ? fromuser.id : '',
		touser: touser ? touser.get('username') : '',
		toid: touser ? touser.id : '',
        createdAt: moment(t.createdAt).fromNow(),
        createdAtLong: moment(t.createdAt).format('YYYY-MM-DD HH:mm:ss')
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
		res.render('login.ejs');
		return;
	}
	var type = req.query.type;
	var status = req.query.status;
	var rating = req.query.rating;
	var token = req.token;
	
	var query = new AV.Query('Project');
	query.ascending('status');
	query.descending('createdAt');
	query.equalTo('creator', AV.User.current());
	query.equalTo('type', type);
	query.equalTo('status', status);
	if (rating) {
		query.equalTo('rating', parseInt(rating));
	}
	query.find().then(function(projects) {
		projects = projects || [];
		projects = _.map(projects, transformProject);
		res.render('list', {
			projects: projects,
			token: token
		});
	}, mutil.renderErrorFn(res));
});

app.get('/follow', function (req, res) {
	if (!login.isLogin(req)) {
		res.render('login.ejs');
		return;
	}
	var type = req.query.type;
	var status = req.query.status;
	var rating = req.query.rating;
	var token = req.token;
	
	var query = new AV.Query('Project');
	query.ascending('status');
	query.descending('createdAt');
	query.equalTo('group', AV.User.current());
	query.equalTo('type', type);
	query.equalTo('status', status);
	if (rating) {
		query.equalTo('rating', parseInt(rating));
	}
	query.find().then(function(projects) {
		projects = projects || [];
		projects = _.map(projects, transformProject);
		res.render('follow', {
			projects: projects,
			token: token
		});
	}, mutil.renderErrorFn(res));
});

app.post('/projects', function (req, res) {
	if (!login.isLogin(req)) {
		res.render('login.ejs');
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

function isProjectEmpty(project) {
    return !project || project.get('name') == null;
}

app.get('/projects/:id/comments', function (req, res) {
	if (!login.isLogin(req)) {
		res.render('login.ejs');
		return;
	}
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
			if (projects) {
				var project = projects[0];
				var relation = project.relation("attachments");
                project = transformProject(project);
                comments = _.map(comments, transformComment);
                //ticket.visible = judgeVisibleForOne(open, isAdmin, cid, ticket.cid);
                //judgeVisible(threads, isAdmin, cid, ticket.cid);
                //var lastOpen = findMyLastOpen(isAdmin, ticket, threads);
				relation.query().find({
					success: function(attachs){
						res.render('edit', { 
							project: project, 
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
		res.render('login.ejs');
		return;
	}
	var token = req.token;
	var client = req.client;
	res.render('new', {
		token: token,
		client: client
	});
});

app.get('/', function (req, res) {
	res.redirect('/projects');
});

app.get('/contact', function (req, res) {
	if (!login.isLogin(req)) {
		res.render('login.ejs');
		return;
	}
	var cid = req.cid;
	var client = req.client;
	var query = new AV.Query(Follower);
	query.equalTo("user", AV.User.current());
	query.find({
		success: function(results) {
			var userIds = [];
			for (var i = 0, len = results.length; i < len; i++) {
				userIds[i] = results[i].get('follower').id;
			}

			var q = new AV.Query(AV.User);
			q.containedIn("objectId", userIds);
			q.find({
				success: function(users) {
					var subf = " in (select follower from _Follower where user=pointer('_User', ?)) ";
					// 好友发起项目查询
					AV.Query.doCloudQuery("select * from Project where creator " + subf, [cid], {
						success: function(result){
							var cps = result.results;
							// 好友参加项目查询
							AV.Query.doCloudQuery("select * from Project where group " + subf, [cid], {
								success: function(result){
									var gps = result.results;
									// 好友邀请我参与项目查询
									AV.Query.doCloudQuery("select * from Project where group in (select * from _User where objectId=?) and creator " + subf, [cid, cid], {
										success: function(result) {
											var mps = result.results;
											users = _.map(users, transformUser);
											users = countUp(users, cps, gps, mps);
											res.render('contact', {users: users, client: client});
										}
									});
								}
							});
						}
					});
				}
			}, mutil.renderErrorFn(res));
		}
	}, mutil.renderErrorFn(res));
});

function countUp(users, cps, gps, mps) {
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
	if(gps){
		for (var i = 0, li = gps.length; i < li; i++) {
			var gp = gps[i];
			for (var j = 0, lj = users.length; j < lj; j++) {
				var user = users[j];
				var relation = gp.relation('group');
				relation.query().find({
					success: function(list){
						for(var k = 0, lk = list.length; k < lk; k++) {
							if (user.id == list[0].id) {
								user.gcnt++;
							}
						}
					}
				});
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

app.get('/contact/profile/:uid', function (req, res) {
	if (!login.isLogin(req)) {
		res.render('login.ejs');
		return;
	}
	var uid = req.params.uid;
	var client = req.client;
	var query = new AV.Query(AV.User);
	var cid = req.cid;
	query.get(uid, {
		success : function(user) {
			user = transformUser(user);
			AV.Query.doCloudQuery("select count(*), * from Project where creator=pointer('_User', ?)", [uid], {
				success: function(result){
					var crs = result.results;
					var ccnt = result.count; // 发起项目数量

					var mcnt = 0; // 邀请我参与项目数量
					var pcnt = 0; // 完成融资项目数量
					var mrs = []; // 邀请我参与项目集合

					for (var i = 0; i < ccnt; i++) {
						var p = crs[i];
						if (p.get('status') == "COMPLETE") {
							pcnt++;
						}
					}

					AV.Query.doCloudQuery("select count(*) from Project where group in (select * from _User where objectId=?)", [uid], {
						success: function(result){
							var grs = result.results;
							var gcnt = result.count; // 参与项目数量

							AV.Query.doCloudQuery("select count(*), * from Project where creator=pointer('_User', ?) and group in (select * from _User where objectId=?)", [uid, cid], {
								success: function(result){
									var mrs = result.results; // 邀请我参加项目集合
									mrs = _.map(mrs, transformProject);
									var mcnt = result.count; // 邀请我参与项目数量

									res.render('profile', {user: user, ccnt: ccnt, gcnt: gcnt, pcnt: pcnt, mcnt: mcnt, mrs: mrs});
								}
							});
						}
					});
				}
			});
		}
	});
});

app.get('/search', function (req, res) {
	if (!login.isLogin(req)) {
		res.render('login.ejs');
		return;
	}
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
        url: 'https://cn.avoscloud.com/1.1/search/select?limit=' + total + '&clazz=Project&q=' + searchContent,
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
            res.render('search', { projects: projects, content:content, searchPage:true});
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
		res.render('login.ejs');
	}
});

app.post('/register', function (req, res) {
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
});

app.post('/login', function (req, res) {
	var username = req.body.username;
	var password = req.body.password;
	AV.User.logIn(username, password, {
		success: function (user) {
			res.redirect('/projects');
		},
		error: function (user, error) {
			mutil.renderError(res, error.message);
		}
	});
});

app.get('/register', function (req, res) {
	if (login.isLogin(req)) {
		res.redirect('/projects');
	} else {
		res.render('register.ejs');
	}
});

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

