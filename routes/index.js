var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var User = require('../models/user.js');
var Post = require('../models/post.js');
var letvSdk = require('../models/letvServerAPI.js');
var mission = require('../models/mission.js');
var error = require('../models/error.js');

router.get('/',function(req, res) {
  Post.get(null,function(err, posts){
  	if(err){
  		posts = [];
  	}
  	res.render('index',{
  		title:'首页',
  		posts:posts
  	});
  });
});

router.get("/u/:user",function(req,res){
	User.get(req.params.user,function(err,user){
		if(!user){
			req.flash('error','用户不存在');
			return res.redirect('/');
		}

		Post.get(user.name,function(err,posts){
			if(err){
				req.flash('error',err);
				return res.redirect('/');
			}
			res.render('user',{
				title:user.name,
				posts:posts
			});

		});
	});
});

router.post('/post',checkLogin);
router.post("/post",function(req,res){
	var currentUser = req.session.user;
	var post = new Post(currentUser.name,req.body.post);
	post.save(function(err){
		if(err){
			req.flash('error',err);
			return res.redirect('/');
		}

		req.flash('success','发表成功');
		console.log(currentUser);
		res.redirect('/u/'+currentUser.name);
	});
});

router.get('/reg',checkNotLogin);
router.get('/reg',function(req,res){
	res.render('reg',{
		title:"用户注册"
	});
});

router.post('/reg',checkNotLogin);
router.post("/reg",function(req,res){
	console.log(req.body);
	//检验用户两次输入口令是否一致
	if(req.body['password-repeat']!=req.body['password']){
		req.flash('error','两次输入的口令不一致');
		return res.redirect('/reg');
	}

	//生成口令的散列值
	var md5 = crypto.createHash('md5');
	var password = md5.update(req.body.password).digest('base64');

	var newUser = new User({
		name : req.body.username,
		password:password
	});

	//检查用户名是否已经存在
	User.get(newUser.name,function(err,user){
		if(user){
			err = 'Username already exists.';
		}
		if(err){
			req.flash('error',err);
			console.log("err");
			return res.redirect('/reg');
		}
		console.log("save");
		//如果不存在则新增用户
		newUser.save(function(err){
			if(err){
				req.flash('error',err);
				console.log("save err");
				console.log(err);
				return res.redirect('/reg');
			}
			req.session.user = newUser;
			req.flash('success','注册成功');
			return res.redirect('/');
		});
		
	});
});

router.get('/login',checkNotLogin);
router.get("/login",function(req,res){
	res.render('login',{
		title:'用户登入'
	});
});

router.post('/login',checkNotLogin);
router.post("/login",function(req,res){
	//生成口令的散列值
	var md5 = crypto.createHash('md5');
	var password = md5.update(req.body.password).digest('base64');

	User.get(req.body.username,function(err,user){
		if(!user){
			req.flash('error','用户不存在');
			return res.redirect('/login');
		}
		if(user.password!=password){
			req.flash('error','用户口令错误');
			return res.redirect('/login');
		}
		req.session.user = user;
		req.flash('success','登入成功');
		res.redirect('/');
	});
});

router.get("/logout",checkLogin);
router.get("/logout",function(req,res){
	req.session.user = null;
	req.flash('success','登出成功');
	res.redirect('/');
});

function checkLogin(req,res,next){
	if(!req.session.user){
		req.flash('error',"未登入");
		return res.redirect('/login');
	}
	next();
};

function checkNotLogin(req,res,next){
	if(req.session.user){
		req.flash("error","已登入");
		return res.redirect('/');
	}
	next();
};


//hy
//搜索
router.get('/search', function(req, res, next) {
  res.render('search');
});

router.post('/search', function(req, res, next){
  console.log(req.body);
  letvSdk.videoList(req.body.videoName, function(data){
  	//data = JSON.parse(data.toString());
  	console.log(data.toString());
  	res.send(data.toString());
  });
});

//创建观影任务
router.get('/createMission', function(req, res, next){
	res.render('missionTest');
})

router.post('/createMission', function(req, res, next){
  mission.create(mission.postReqToMission(req), function(err, mid){
  	if (err){
  	  res.send(JSON.stringify({code : error.DB_ERROR, message : 'error'}));
  	}
  	res.send(JSON.stringify({code : 0, message : 'success', data : {mid : mid}}));
  });
});

//显示任务
router.get('/showMission', function(req, res, next){
  mission.get(req.query.mid, function(err, records){
  	if (err)
  	  res.send(JSON.stringify({code : error.DB_ERROR, message : 'mid not found'}));
  	else
  	  res.send(JSON.stringify({code : 0, message : 'success', data : {records : records}}))
  });
});

//删除任务
router.get('/removeMission', function(req, res, next){
  mission.remove(req.query.mid, function(err){
  	if (err)
  	  res.send(JSON.stringify({code : error.DB_ERROR, message : 'remove error'}));
  	else
  	  res.send(JSON.stringify({code : 0, message : 'success'}));
  });
});

//更新任务
router.get('/updateMission', function(req, res, next){
  res.render('missionTest');
});

router.post('/updateMission', function(req, res, next){
  mission.update(req.body.mid, mission.postReqToMission(req), function(err, ret){
  	if (err)
  	  res.send(JSON.stringify({code : error.DB_ERROR, message : 'error'}));
  	else
  	  res.send(JSON.stringify({code : 0, message : 'success'}));
  });
});


//观看视频，例如：127.0.0.1/letv?mid=57406e33a91aa1437275f8dd
router.get('/letv', function(req, res, next){
  mission.get(req.query.mid, function(err, records){//获得任务信息
  	if (err)
  	  res.render('error', {message: 'mission not found', error: {} });
  	else{
  	  var ms = records[0];
  	  //检查时间
  	  var endTime = new Date(ms.beginTime);
  	  endTime.setSeconds(endTime.getSeconds() + ms.duration);
  	  if (Date.now() > endTime){
  	  	mission.remove(req.query.mid, function(err){});//删除任务
  	  	res.render('error', {message: 'mission not found', error: {} });
  	  }
  	  //渲染
  	  res.render('letv', {
  	  	title: ms.videoName,
  	  	vu: ms.vu,
  	  	beginTime: ms.beginTime
  	  });
  	}
  });
});

//初始化上传视频
router.post('/html5UploadInit', function(req, res, next){
  console.log('req.query', req.query);
  letvSdk.uploadInit(req.query.video_name, parseInt(req.query.file_size), parseInt(req.query.uploadtype), function(data){
    data = JSON.parse(data.toString());
    if (data['code'] != 0)
      return;
    res.send(data);
  });
});


//上传视频
router.get('/upload', function(req, res, next){
	res.redirect('/html/html5Upload.html');
})



module.exports = router;
