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

app.post("/updateCounter/mtn", function(req, res) {
	//console.log(req.body);
	var msg = req.body.message;
	var meg_parts = msg.split(" ");
	var amt = meg_parts[3];
	var from = meg_parts[7];
	var row_from = from.split(":")[1];
	var row_amt = parseInt(amt.split(":")[1].substr(3, amt.split(":")[1].length));
	
	db.update({phone: row_from}, {$inc:{counter: row_amt}}, {}, function(err, doc){
		res.status(200).send();		
	});
});

app.post("/updateCounter/tg", function(req, res) {
	console.log(req.body);
	var msg = req.body.message;
	var msg_parts = msg.split(" ");
	
	var from = msg_parts[11];
	var amt = msg_parts[9];
	
	db.update({phone: from}, {$inc: {counter: amt}}, {}, function(err, doc) {
	   res.status(200).send(); 
	});
	
});

app.post("/updateCounter/air", function(req, res) {
	console.log(req.body);
	var msg = req.body.message;
	var msg_parts = msg.split(" ");
	
	var from = "250" + msg_parts[6];
	var amt = msg_parts[3];
	
	db.update({phone: from}, {$inc: {counter: amt}}, {}, function(err, doc) {
	   res.status(200).send(); 
	});
	
	res.status(200).send();
});

var HP_HOST = "52.21.130.230", HP_PORT = 12321;
var ORIGIN_CLIENT = "this_is_vuga_client";
var net = require('net');

app.post("/transaction", function(req, res, next){

	db.findOne({_id: req.body._id}, function(err, doc){
		req.user = doc;
		next();
	});

},function(req, res){

	var client = new net.Socket();

	var json_for_hp = {
		origin: ORIGIN_CLIENT,
		phone: req.body.phone,
		amount: String(req.body.amount),
	};

	client.connect(HP_PORT, HP_HOST, function(){
		client.write( JSON.stringify(json_for_hp) );
	});

	client.on('data', function(data){
		// update db
		var transaction = {
			from: req.user.phone,
			to: req.body.phone,
			amount: req.body.amount,
			date: new Date(),
			status: String(data),
		};
		db.update({_id: req.body._id}, { $push: { transactions: transaction } }, {}, function(err, doc){
			console.log("Inserted");
		});
		// push gcm
		client.destroy();
	});

});



http.listen(process.env.PORT || 3000, function(){
  console.log('listening on *:3000');
});
