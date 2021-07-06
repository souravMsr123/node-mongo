var express = require("express")
var app = express();
var http = require("http").createServer(app)
var mongodb = require("mongodb")
var mongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectID;
var bcrypt = require("bcrypt")
var expressSession = require("express-session")
var fileSystem = require("fs")
var jwt = require("jsonwebtoken")
const excelToJson = require('convert-excel-to-json');
const multer = require('multer');
const fs = require('fs');
const cron = require("node-cron");
const { Server } = require("socket.io");
const io = new Server(http);
global.__basedir = __dirname;
 
// -> Multer Upload Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, __basedir + '/uploads/')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname)
    }
});
 
const upload = multer({storage: storage});

// cron job scheduling
cron.schedule("0 0 * * *", async function() {
    console.log("running a task every midnight");
   await addUserCountToDB()
});


// helper function to return user doc
function getUser(id,callback){
    database.collection("users").findOne({
        "_id":ObjectId(id)
    }, function(err,user){
        callback(user)
    })
}
function isAuthenticated(req, res, next) {
    if (typeof req.headers.authorization !== "undefined") {
        // retrieve the authorization header and parse out the
        // JWT using the split function
        let token = req.headers.authorization.split(" ")[1];
        // Here we validate that the JSON Web Token is valid and has been 
        // created using the same private pass phrase
        jwt.verify(token, "MySuperSecretPassPhrase", { algorithm: "HS256" }, (err, user) => {
            
            // if there has been an error...
            if (err) {  
                // shut them out!
                res.status(500).json({ error: "Not Authorized" });
                throw new Error("Not Authorized");
            }
            // if the JWT is valid, allow them to hit
            // the intended endpoint
            return next();
        });
    } else {
        // No authorization header exists on the incoming
        // request, return not authorized and throw a new error 
        res.status(500).json({ error: "Not Authorized" });
        throw new Error("Not Authorized");
    }
}
async function addUserCountToDB(){
   let result = await db.collection("users").find( { $where: function() { 
        today = new Date(); //
        today.setHours(0,0,0,0);
        return (this._id.getTimestamp() >= today)
    } } );

    database.collection("userLogs").insertOne({
        "count":result.length,
        date:new Date()
    }, (err, res) => {
        if (err) throw err;
        console.log("Number of documents inserted: " + res.insertedCount);
        
    });
}
// -> Import Excel File to MongoDB database
function importExcelData2MongoDB(filePath){
    // -> Read Excel File to Json Data
    const excelData = excelToJson({
        sourceFile: filePath,
        sheets:[{
            // Excel Sheet Name
            name: 'Users',
 
            // Header Row -> be skipped and will not be present at our result object.
            header:{
               rows: 1
            },
			
            // Mapping columns to keys
            columnToKey: {
                A: '_id',
                B: 'name',
                C: 'address',
                D: 'age'
            }
        }]
    });
 
    // -> Log Excel Data to Console
    console.log(excelData);
 
   

    // Insert Json-Object to MongoDB
    database.collection("users").insertMany(excelData.Users, (err, res) => {
        if (err) throw err;
        console.log("Number of documents inserted: " + res.insertedCount);
        
    });
			
    fs.unlinkSync(filePath);
}
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.use("/public", express.static(__dirname +"/public"))
app.set("view engine", "ejs")
http.listen(3000,function(){
    console.log("server started on localhost:3000...!!");

    mongoClient.connect("mongodb://localhost/27017",{
        
        useNewUrlParser: true,
        useUnifiedTopology: true
      }, function(err,client){
        database = client.db("node-mongo");
        database.collection("users").createIndex( { name: "text", description: "text" } )

       

        app.post("/signup", (req,res)=>{
            console.log('body', req)
            database.collection("users").findOne({
                "email": req.body.email
            }, function(err,user){
                if(user===null){
                    bcrypt.hash(req.body.password,10, function(err,hash){
                        database.collection("users").insertOne({
                            "name": req.body.name,
                            "about":req.body.about,
                            "email": req.body.email,
                            "password": hash,
                        }, function(err,data){
                            db.collection("users").createIndex( { name: "text", description: "text" } )

                            res.status(200).json({
                                message:"User succesfully created..!"
                            })
                        })
                    })
                }else{
                    res.status(409).json({
                        message:"User succesfully created..!"
                    })
                }
            })
        })

        

        app.post("/login", (req,res)=>{
            
            database.collection("users").findOne({
                "email": req.body.email
            }, function(err,user){
                if(user===null){
                    res.status(404).json({
                        message:"User does not exsist..!"
                    })
                }else{
                    bcrypt.compare(req.body.password,user.password, function(err,iseVerified){
                        if(iseVerified){
                            let token = jwt.sign({"id":user._id,"email":user.email}, "MySuperSecretPassPhrase", { algorithm: 'HS256'},{

                                expiresIn: '365d' // expires in 365 days
                     
                           });

                           io.on('connection', (socket) => {
                            console.log('a user connected');
                            socket.on('disconnect', () => {
                              console.log('user disconnected');
                            });
                          });


                            res.status(200).json({
                                token:token,
                                message:"User user logged in succefully..!"
                            })
                        }else{
                            res.status(401).json({
                               
                                message:"Password wrong..!"
                            })
                        }
                    })
                    
                }
            })
        })

       

      

        app.post('/api/uploadfile',isAuthenticated, upload.single("uploadfile"), (req, res) =>{
            importExcelData2MongoDB(__basedir + '/uploads/' + req.file.filename);
            res.status(200).json({
                "message": 'File uploaded/import successfully!', 'file': req.file
            });
        });

        app.get("/search", isAuthenticated, async(req,res)=>{
           let result = await  database.collection("users").find( { $text: { $search: req.query.text} } )
           res.status(200).json({
            "message":"Your serach result..!!",
            data:result,
            count:result.length
        });
        })


    })
    
})