var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var http = require('http').Server(app);
var Datastore = require('nedb');
var crypto = require('crypto');
var db = new Datastore({filename:__dirname + '/database.db', autoload: true});

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())


function removePhonePlus(req, res, next){
	if( req.body.phone[0] == "+" )
		req.body.phone = req.body.phone.substr(1, req.body.phone.length);
	next();
}

function date () {
	var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1; //January is 0!

    var yyyy = today.getFullYear();
    if(dd<10){
        dd='0'+dd
    } 
    if(mm<10){
        mm='0'+mm
    } 
    return dd+'/'+mm+'/'+yyyy;
}

app.post("/register", removePhonePlus, function(req, res){
	db.find({name: req.name}, function(err, doc){
		if(doc){
			db.insert({
				name: req.body.name,
				phone: req.body.phone,
				password: crypto.createHash('md5').update(req.body.password).digest("hex"),
				transactions: {
					incoming:[],
					outgoing:[],
				},
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

app.post("/loginWithPhone", removePhonePlus, function(req, res){
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

var OUTGOING_TRANSACTION = "outgoing_transaction", INCOME_TRANSACTION = "incoming_transaction";

app.post("/updateCounter/mtn", function(req, res) {
	console.log(req.body);
	var msg = req.body.message;
	var msg_parts = msg.split(" ");

	var row_amt = parseInt(msg_parts[3]);
	
	var i = 3
	while( msg_parts[i][0] != "(" ) i++;
	var row_from = msg_parts[i].substr(1, msg_parts[i].length - 2);
	
	var mmm = row_from + " > " + row_amt;
	console.log(mmm);

	var transaction = {
		type: INCOME_TRANSACTION,
		from: row_from,
		amount: row_amt,
		date: date(),
	}
	
	db.update({phone: row_from}, {$inc:{counter: row_amt}, $push: {"transactions.incoming": transaction}}, {}, function(err, doc){
		res.status(200).send();		
	});
});

app.post("/updateCounter/tg", function(req, res) {
	console.log(req.body);
	var msg = req.body.message;
	var msg_parts = msg.split(" ");
	
	var from = msg_parts[11];
	var amt = parseInt(msg_parts[9]);
	
	var transaction = {
		type: INCOME_TRANSACTION,
		from: from,
		amount: amt,
		date: date(),
	}
	
	db.update({phone: from}, {$inc: {counter: amt}, $push: {"transactions.incoming": transaction}}, {}, function(err, doc) {
	   res.status(200).send(); 
	});
	
});

app.post("/updateCounter/air", function(req, res) {
	console.log(req.body);
	var msg = req.body.message;
	var msg_parts = msg.split(" ");
	
	var from = "250" + msg_parts[6];
	var amt = parseInt(msg_parts[3]);
	
	var transaction = {
		type: INCOME_TRANSACTION,
		from: from,
		amount: amt,
		date: date(),
	};
	
	db.update({phone: from}, {$inc: {counter: amt}, $push: {"transactions.incoming": transaction}}, {}, function(err, doc) {
		if(!err)
	   		res.status(200).send(); 
	   	else
	   		console.log(err);
	});
	
	//res.status(200).send();
});

var HP_HOST = "52.21.130.230", HP_PORT = 12321;
var ORIGIN_CLIENT = "this_is_vuga_client";
var net = require('net');

app.post("/transaction", function(req, res, next){

	db.findOne({_id: req.body._id}, function(err, doc){
		if( !doc )
			res.status(401).send({error:"Unauthorisated."});
		else if( doc.counter < parseInt(req.body.amount) )
			res.status(401).send({error:"You don`t have enought credit."});
		else {
			req.user = doc;
			next();
		}
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
			type: OUTGOING_TRANSACTION,
			from: req.user.phone,
			to: req.body.phone,
			amount: req.body.amount,
			date: date(),
			status: String(data),
		};
		
		// if the request failed, count must be inc with 0 (not changed)
		if( String(data) != "0" ) req.body.amount = 0;
		
		db.update({_id: req.body._id}, { $push: { "transactions.outgoing": transaction }, $inc: { counter: -parseInt(req.body.amount)} }, {}, function(err, doc){
			if( String(data) == "0" )
				res.status(200).send({message: "Transaction succeded."});
			else
				res.status(200).send({message: "Transaction failed."});
		});
		// push gcm
		client.destroy();
	});

});

http.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  console.log('Vuga backend started.');
});