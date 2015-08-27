var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var http = require('http').Server(app);
var Datastore = require('nedb');
var crypto = require('crypto');
var db = new Datastore({filename:__dirname + '/database.db', autoload: true});

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())



app.post("/register", function(req, res){
	db.find({name: req.name}, function(err, doc){
		if(doc){
			db.insert({
				name: req.body.name,
				phone: req.body.phone,
				password: crypto.createHash('md5').update(req.body.password).digest("hex"),
				transactions: [],
				counter: 0,
			}, function(err, doc){
				res.status(200).send(doc);
			})			 	
		} else {
			console.log(err);
		}
	});
});

app.post("/login", function(req, res){
	db.findOne({name: req.body.name}, function(err, doc){
		if(!err){
			if(doc){
				if( doc.password == crypto.createHash('md5').update(req.body.password).digest("hex") ){
					// password match ! user loged in
					res.status(200).send(doc);
				} else {
					// password not matche
					res.status(401).send({
						error: "Incorrect password.",
					});
				}
			} else {
				// user not found
				res.status(401).send({
					error: "This username could not be found.",
				});
			}
		} else {
			//some other error
			req.status(500).send({
				error: "We have an error, please try again.",
			});
		}
	})
});

app.post("/loginWithPhone", function(req, res){
	console.log(req.body);
	db.findOne({phone: req.body.phone}, function(err, doc){
		if(!err && doc){
			res.status(200).send(doc);
		} else {
			res.status(404).send({});
		}
	});
});

app.get('/authenticate', function(req, res){
	db.findOne({_id: req.body._id}, function(err, doc){
		if( !err && doc )
			res.status(200).send();
		else 
			res.status(404).send();
	});
});

app.get('/me/:id', function(req, res){
	console.log(req.params);
	db.findOne({_id: req.params.id}, function(err, doc){
		if( !err && doc )
			res.status(200).send(doc);
		else 
			res.status(404).send();
	});
});

app.get('/me/counter', function(req, res){
});

app.get('/me/transactions', function(req, res){
});

app.post('/ping', function(req, res){
	console.log(req.body);
	res.send({message:"salut lume"});
});



http.listen(3000, function(){
  console.log('listening on *:3000');
});
