var express = require("express")
var app = express();
var http = require("http").createServer(app)
var mongodb = require("mongodb")
var mongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectID;
var bcrypt = require("bcrypt")
var expressSession = require("express-session")
var formidable = require("formidable")
var fileSystem = require("fs")
var {getVideoDurationInSeconds, default: getVideoDurationInSeconds} = require("get-video-duration")

app.use(expressSession({
    "key":"user_id",
    "secret":"User secret Object Id",
    "resave":true,
    "saveUninitialized":true
}))

// helper function to return user doc
function getUser(id,callback){
    database.collection("users").findOne({
        "_id":ObjectId(id)
    }, function(err,user){
        callback(user)
    })
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
        database = client.db("my_video_streaming")

        app.get("/", function(req,res){
            res.render("index",{
                "isLogIn": req.session.user_id?true:false
            })
        })
    
        app.get("/signup", function(req,res){
            res.render("signup")
        })
    
        

        app.post("/signup", function(req,res){
            console.log('body', req)
            database.collection("users").findOne({
                "email": req.body.email
            }, function(err,user){
                if(user===null){
                    bcrypt.hash(req.body.password,10, function(err,hash){
                        database.collection("users").insertOne({
                            "name": req.body.name,
                            "email": req.body.email,
                            "password": hash,
                            "coverPhoto":"",
                            "image":"",
                            "subscribers":"",
                            "subscriptions":[],
                            "playlists":[],
                            "videos":[],
                            "history":[],
                            "notifications":[]
                        }, function(err,data){
                            res.redirect("/login")
                        })
                    })
                }else{
                    res.send("Email already exist..!!")
                }
            })
        })

        app.get("/login", function(req,res){
            res.render("login", {
                "error":"",
                "message":""
            })
        })

        app.post("/login", function(req,res){
            
            database.collection("users").findOne({
                "email": req.body.email
            }, function(err,user){
                if(user===null){
                    res.send("Email does not exist..!!")
                }else{
                    bcrypt.compare(req.body.password,user.password, function(err,iseVerified){
                        if(iseVerified){
                            req.session.user_id = user._id;
                            res.redirect("/")
                        }else{
                            res.send("Password is not correct..!!")
                        }
                    })
                    
                }
            })
        })

        app.get("/logout", function(req,res){
            req.session.destroy();
            res.redirect("/")
        })

        app.get("/upload", function(req,res){
            if(req.session.user_id){
                res.render("upload",{
                    "islogIn": true
                })
            }else{
                res.redirect("/login")
            }
        })

        app.post("/upload-video", function(req,res){
            if(req.session.user_id){
            var formData = new formidable.IncomingForm();
            formData.maxFileSIze = 1000 * 1024 * 1024;
            formData.parse(req, function(error,fields,files){
                var title = fields.title;
                var description = fields.description;
                var category = fields.category;
                var tags = fields.tags

                var oldPathThumbnail = files.thumbnail.path;
                var thumbnail = "/public/thumbnails" + new Date().getTime() + '-' + files.thumbnail.name;

                fileSystem.rename(oldPathThumbnail,thumbnail, function(err){

                })

                var oldPathVideo = files.video.path;
                var newPath = "/public/videos/" + new Date().getTime() + '-' + files.video.name

                fileSystem.rename(oldPathVideo,newPath, function(err){

                    getUser(req.session.user_id, function(user){
                        var currentTime = new Date().getTime();

                        getVideoDurationInSeconds(newPath).then(function(duration){
                            var hours = Math.floor(duration/60/60);
                            var minutes = Math.floor(duration/60)- (hourts * 60);
                            var seconds = Math.floor(duration%60);

                            database.collection("videos").insertOne({
                                "user":{
                                    "id": user._id,
                                    "id": user.name,
                                    "id": user.image,
                                    "subscribers": user.subscribers
                                },
                                "filePath":newPath,
                                "thumbnail":thumbnail,
                                "title":title,
                                "description":description,
                                "tags":tags,
                                "category":category,
                                "createdAt":currentTime,
                                "hours":hours,
                                "minutes":minutes,
                                "seconds":seconds,
                                "watch":currentTime,
                                "viewa":0,
                                "playlists":"",
                                "likers":[],
                                "dislikers":[],
                                "comments":[]
                                 },function (error,data) {
                                   database.collection("users").updateOne({
                                       "_id": ObjectId(req.session.user_id)
                                   },{
                                       $push:{
                                           "videos":{
                                               "_id":data.insertedId,
                                               "thumbnail":thumbnail,
                                               "title":title,
                                               "watch":currentTime,
                                               "viewa":0

                                           }
                                       }
                                   })  
                                 });
                                 res.redirect("/");
                        })
                    })
                })
            })
            }else{
                res.redirect("/login")
            }
        })
    })
    
})