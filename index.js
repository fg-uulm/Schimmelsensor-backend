//Imports und Variablen
var mqtt = require('mqtt')
var mqttclient = mqtt.connect('mqtt://mqtt.hfg.design')
const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://Andja:Janklause1@andjascluster.z6wgc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
const dbclient = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

var db;
var data;
var userData;
var sessions = {};

const {
  v4: uuidv4
} = require('uuid');
const bcrypt = require('bcryptjs');
const saltRounds = 10;
var express = require('express')
const app = express()
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
const port = 3000
const cors = require('cors');
const corsSettings = {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
};
app.use(cors(corsSettings));
app.listen(port, () => {
  console.log(`user data service live @ http://localhost:${port}`);
});


//function Sammlungen

function createSession(userData, token) {
  sessions[token] = {
    userId: userData._id,
    createdAt: new Date(),
    modifiedAt: new Date(),
    token: token
  }
  console.log(sessions)
}

function saveData(message) {
  let doc = JSON.parse(message);
  doc.createdat = new Date();
  if (data) {
    data.insertOne(doc, (err, res) => {
      //console.log(err)
      const insertedCount = res.insertedCount;
      console.log("inserted " + insertedCount + " document(s) in database.");
    })
  }
}
//alles andere

mqttclient.on('connect', function () {
  mqttclient.subscribe('/sweavs/jan/Messungen', function (err) {
    if (!err) {
      console.log("Verbunden mit Mqtt");
    }
  })
})

dbclient.connect(err => {
  //console.log(err)
  console.log("Verbunden mit der Schimmelbank");
  db = dbclient.db("Schimmelsensor");
  data = db.collection("Eingangsdaten");
  userData = db.collection("Users") //users anlegen in datenbank
  mqttclient.on('message', function (topic, message) {
    // message is Buffer
    //console.log(message.toString());
    saveData(message);
  })
})

app.get('/api/latest', (req, res) => {
  data.find({}).sort({
      'createdat': -1
    }).limit(1).next() // limit = anzahl der Daten toArray fhkntion https://docs.mongodb.com/manual/reference/method/cursor.toArray/
    .then(async (latest) => {
      res.send(latest)
    })
})

app.get('/api/last10', (req, res) => {
  data.find({}).sort({
      'createdat': -1
    }).limit(50).toArray() // https://vue-chartjs.org/guide/#chart-with-local-data
    .then(async (latest) => {
      res.send(latest)
    })
})

app.post('/api/register', (req, res) => {
  console.log("registering new user");
  let user = req.body;
  user.createdAt = new Date();


  user.hashedPW = bcrypt.hashSync(user.password, saltRounds);
  delete user.password;

  console.log(user);

  userData.insertOne(user, (err, dbres) => {
    // console.log("showing user's password to the world");
    if (err) {
      console.log("error");
      res.status(500).send({
        "action": "register",
        "success": false,
        "message": "error while inserting into mongoDB",
        "error": err
      });
    } else {
      console.log("created new user");
      res.status(200).send({
        "action": "register",
        "success": true,
        "message": "created new user",
        "error": null
      });
    }
  })
})

app.post('/api/login', (req, res) => {
  console.log("logging in user");
  let sentdata = req.body;
  userData.findOne({
      username: sentdata.username
    })
    .then((dbres) => {
      if (dbres) {
        if (bcrypt.compareSync(sentdata.password, dbres.hashedPW)) {
          console.log("login successful");
          let token = uuidv4();
          createSession(dbres, token);
          // console.log(sessions);
          res.status(200).send({
            action: "login",
            success: true,
            message: "logged in",
            error: null,
            token: token
          });
        } else {
          res.status(500).send("wrong pw");
          console.log("User hat falsches Daten eingegeben")
        }
      } else {
        res.status(500).send("user not found");
      }
    })
})
