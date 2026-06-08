require("dotenv").config();

const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err.message));

/* =========================
CLOUDINARY CONFIG
========================= */


cloudinary.config({
cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
api_key: process.env.CLOUDINARY_API_KEY,
api_secret: process.env.CLOUDINARY_API_SECRET
});

/* =========================
CLOUDINARY TEST
========================= */

app.get("/api/cloudinary-test", async (req, res) => {

try {

const result = await cloudinary.api.ping();

res.json({
  success: true,
  result
});

} catch (error) {

res.status(500).json({
  success: false,
  message: error.message
});

}

});

/* =========================
   USER SCHEMA
========================= */

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    username: {
      type: String,
      required: true,
      unique: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    avatar: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    whatsapp: {
      type: String,
      default: "",
    },

    bio: {
      type: String,
      default: "",
    },

    city: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      default: "user",
    },

    verified: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      default: "active",
    },

    catsPosted: {
      type: Number,
      default: 0,
    },

    successfulAdoptions: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

/* =========================
   JWT
========================= */

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
};

/* =========================
   AUTH MIDDLEWARE
========================= */

const protect = async (req,res,next)=>{

try{

const authHeader =
req.headers.authorization;

if(!authHeader){

return res.status(401).json({
success:false,
message:"No token provided"
});

}

const token =
authHeader.split(" ")[1];

const decoded =
jwt.verify(
token,
process.env.JWT_SECRET
);

req.user =
await User.findById(
decoded.id
).select("-password");

if(
!req.user ||
req.user.status === "banned"
){

return res.status(403).json({
success:false,
message:"ACCOUNT_BANNED"
});

}

next();

}catch(error){

return res.status(401).json({
success:false,
message:"Invalid token"
});

}

};
/* =========================
MULTER CONFIG
========================= */

const upload = multer({
storage: multer.memoryStorage()
});

/* =========================
UPLOAD IMAGE TO CLOUDINARY
========================= */

app.post(
"/api/upload",
protect,
upload.single("image"),
async (req,res)=>{

try{

if(!req.file){

return res.status(400).json({
success:false,
message:"No image selected"
});

}

const base64 =
`data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

const result =
await cloudinary.uploader.upload(
base64,
{
folder:"meownest"
}
);

res.json({
success:true,
imageUrl:result.secure_url
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

}
);
/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    project: "MeowNest",
    message: "🐱 MeowNest API Running",
  });
});

/* =========================
   REGISTER
========================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      name,
      username,
      email,
      password,
    } = req.body;

    const emailExists = await User.findOne({ email });

    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const usernameExists = await User.findOne({ username });

    if (usernameExists) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      username,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


/* =========================
LOGIN
========================= */

app.post("/api/auth/login", async (req,res)=>{

try{

const { email,password } = req.body;

const user = await User.findOne({
email
});

if(!user){

return res.status(400).json({
success:false,
message:"Invalid credentials"
});

}

if(user.status === "banned"){

return res.status(403).json({
success:false,
message:"Your account has been banned by admin."
});

}

const match =
await bcrypt.compare(
password,
user.password
);

if(!match){

return res.status(400).json({
success:false,
message:"Invalid credentials"
});

}

res.json({

success:true,

token:generateToken(
user._id
),

user:{
id:user._id,
name:user.name,
email:user.email,
role:user.role
}

});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
PROFILE
========================= */

app.get(
"/api/auth/profile",
protect,
async (req,res)=>{

res.json({
success:true,
user:req.user
});

}
);
/* =========================
CAT SCHEMA
========================= */

const catSchema = new mongoose.Schema(
{
ownerId:{
type:mongoose.Schema.Types.ObjectId,
ref:"User",
required:true
},

name:{
    type:String,
    required:true
},

breed:{
    type:String,
    default:""
},

age:{
    type:Number,
    default:0
},

gender:{
    type:String,
    default:""
},

color:{
    type:String,
    default:""
},

description:{
    type:String,
    default:""
},

story:{
    type:String,
    default:""
},

vaccinated:{
    type:Boolean,
    default:false
},

friendlyWithKids:{
    type:Boolean,
    default:false
},

friendlyWithPets:{
    type:Boolean,
    default:false
},

indoorOutdoor:{
    type:String,
    default:""
},

images:{
    type:[String],
    default:[]
},

city:{
    type:String,
    default:""
},

status:{
    type:String,
    default:"available"
},

views:{
    type:Number,
    default:0
}

},
{
timestamps:true
}
);

const Cat = mongoose.model("Cat",catSchema);

/* =========================
ADD CAT
========================= */

app.post("/api/cats", protect, async (req,res)=>{

try{

const cat = await Cat.create({
ownerId:req.user._id,
...req.body
});

await User.findByIdAndUpdate(
req.user._id,
{
$inc:{catsPosted:1}
}
);

res.status(201).json({
success:true,
cat
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
GET ALL CATS
========================= */

app.get("/api/cats", async (req,res)=>{

try{

const cats = await Cat.find({
status:"available"
})
.populate(
"ownerId",
"_id name username city avatar phone whatsapp status"
)
.sort({createdAt:-1});

const filteredCats =
cats.filter(
cat =>
cat.ownerId &&
cat.ownerId.status !== "banned"
);

res.json({
success:true,
count:filteredCats.length,
cats:filteredCats
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
GET SINGLE CAT
========================= */

app.get("/api/cats/:id", async (req,res)=>{

try{

const cat = await Cat.findById(req.params.id)
.populate(
"ownerId",
"_id name username city avatar phone whatsapp bio status"
);

if(!cat){

return res.status(404).json({
success:false,
message:"Cat not found"
});

}

if(
cat.ownerId &&
cat.ownerId.status === "banned"
){

return res.status(404).json({
success:false,
message:"Cat not found"
});

}

cat.views += 1;

await cat.save();

res.json({
success:true,
cat
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
MY CATS
========================= */

app.get("/api/my-cats", protect, async (req,res)=>{

try{

const cats = await Cat.find({
ownerId:req.user._id
});

res.json({
success:true,
count:cats.length,
cats
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
DELETE CAT
========================= */

app.delete("/api/cats/:id", protect, async (req,res)=>{

try{

const cat = await Cat.findById(req.params.id);

if(!cat){

return res.status(404).json({
success:false,
message:"Cat not found"
});

}

if(cat.ownerId.toString() !== req.user._id.toString()){

return res.status(403).json({
success:false,
message:"Unauthorized"
});

}

await cat.deleteOne();

res.json({
success:true,
message:"Cat deleted"
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
MARK AS ADOPTED
========================= */

app.put("/api/cats/:id/adopted", protect, async (req,res)=>{

try{

const cat = await Cat.findById(req.params.id);

if(!cat){

return res.status(404).json({
success:false,
message:"Cat not found"
});

}

if(cat.ownerId.toString() !== req.user._id.toString()){

return res.status(403).json({
success:false,
message:"Unauthorized"
});

}

cat.status = "adopted";

await cat.save();

await User.findByIdAndUpdate(
req.user._id,
{
$inc:{successfulAdoptions:1}
}
);

res.json({
success:true,
message:"Cat marked as adopted"
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});
/* =========================
UPDATE PROFILE
========================= */

app.put("/api/auth/profile", protect, async (req,res)=>{

try{

const user = await User.findByIdAndUpdate(

req.user._id,

{
name:req.body.name,
avatar:req.body.avatar,
phone:req.body.phone,
whatsapp:req.body.whatsapp,
bio:req.body.bio,
city:req.body.city
},

{
new:true
}

).select("-password");

res.json({
success:true,
user
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
UPDATE CAT
========================= */

app.put("/api/cats/:id", protect, async (req,res)=>{

try{

const cat = await Cat.findById(req.params.id);

if(!cat){

return res.status(404).json({
success:false,
message:"Cat not found"
});

}

if(cat.ownerId.toString() !== req.user._id.toString()){

return res.status(403).json({
success:false,
message:"Unauthorized"
});

}

const updatedCat = await Cat.findByIdAndUpdate(
req.params.id,
req.body,
{
new:true
}
);

res.json({
success:true,
cat:updatedCat
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});




/* =========================
REPORT SCHEMA
========================= */

const reportSchema = new mongoose.Schema({

reporterId:{
type:mongoose.Schema.Types.ObjectId,
ref:"User",
required:true
},

targetType:{
type:String,
required:true
},

targetId:{
type:String,
required:true
},

catName:{
type:String,
default:""
},

catImage:{
type:String,
default:""
},

ownerId:{
type:mongoose.Schema.Types.ObjectId,
ref:"User"
},

ownerName:{
type:String,
default:""
},

reason:{
type:String,
required:true
},

status:{
type:String,
default:"pending"
}

},{
timestamps:true
});
const Report = mongoose.model(
"Report",
reportSchema
);

/* =========================
CREATE REPORT
========================= */

app.post("/api/reports", protect, async (req,res)=>{

try{

let catName = "";
let catImage = "";
let ownerId = null;
let ownerName = "";

if(req.body.targetType === "cat"){

const cat = await Cat.findById(
req.body.targetId
).populate("ownerId");

if(cat){

catName = cat.name;

catImage =
cat.images?.[0] || "";

ownerId =
cat.ownerId?._id || null;

ownerName =
cat.ownerId?.name || "";

}

}

const report = await Report.create({

reporterId:req.user._id,

targetType:req.body.targetType,

targetId:req.body.targetId,

catName,

catImage,

ownerId,

ownerName,

reason:req.body.reason

});

res.status(201).json({
success:true,
report
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
GET ALL REPORTS
========================= */

app.get("/api/reports", async (req,res)=>{

try{

const reports = await Report.find()
.populate(
"reporterId",
"name username email"
)
.sort({createdAt:-1});

res.json({
success:true,
count:reports.length,
reports
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
GET SINGLE REPORT
========================= */

app.get(
"/api/admin/reports/:id",
protect,
adminOnly,
async (req,res)=>{

try{

const report = await Report.findById(
req.params.id
)
.populate(
"reporterId",
"name username email"
);

if(!report){

return res.status(404).json({
success:false,
message:"Report not found"
});

}

res.json({
success:true,
report
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
MARK REPORT SOLVED
========================= */

app.put(
"/api/admin/reports/:id/solve",
protect,
adminOnly,
async (req,res)=>{

try{

await Report.findByIdAndUpdate(
req.params.id,
{
status:"solved"
}
);

res.json({
success:true,
message:"Report solved"
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
DELETE REPORT
========================= */

app.delete(
"/api/admin/reports/:id",
protect,
adminOnly,
async (req,res)=>{

try{

await Report.findByIdAndDelete(
req.params.id
);

res.json({
success:true,
message:"Report deleted"
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});
/* =========================
PUBLIC USER PROFILE
========================= */

app.get("/api/users/:id", async (req,res)=>{

try{

const user =
await User.findById(
req.params.id
).select("-password");

if(
!user ||
user.status === "banned"
){

return res.status(404).json({
success:false,
message:"User not found"
});

}

res.json({
success:true,
user
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
SEARCH CATS
========================= */

app.get("/api/search", async (req,res)=>{

try{

const q = req.query.q || "";

const cats = await Cat.find({

status:"available",

$or:[

{name:{$regex:q,$options:"i"}},

{breed:{$regex:q,$options:"i"}},

{city:{$regex:q,$options:"i"}}

]

});

res.json({
success:true,
count:cats.length,
cats
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
FILTER CATS
========================= */

app.get("/api/filter", async (req,res)=>{

try{

const filter = {};

if(req.query.city){
filter.city = req.query.city;
}

if(req.query.gender){
filter.gender = req.query.gender;
}

if(req.query.breed){
filter.breed = req.query.breed;
}

if(req.query.status){
filter.status = req.query.status;
}

const cats = await Cat.find(filter);

res.json({
success:true,
count:cats.length,
cats
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
SITE STATS
========================= */

app.get("/api/stats", async (req,res)=>{

try{

const totalUsers = await User.countDocuments();

const totalCats = await Cat.countDocuments();

const availableCats = await Cat.countDocuments({
status:"available"
});

const adoptedCats = await Cat.countDocuments({
status:"adopted"
});

const totalReports = await Report.countDocuments();

res.json({
success:true,
totalUsers,
totalCats,
availableCats,
adoptedCats,
totalReports
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});
/* =========================
ADMIN MIDDLEWARE
========================= */

const adminOnly = (req,res,next)=>{

if(req.user.role !== "admin"){

return res.status(403).json({
success:false,
message:"Admin only"
});

}

next();

};

/* =========================
FAVORITE SCHEMA
========================= */

const favoriteSchema = new mongoose.Schema({

userId:{
type:mongoose.Schema.Types.ObjectId,
ref:"User",
required:true
},

catId:{
type:mongoose.Schema.Types.ObjectId,
ref:"Cat",
required:true
}

},{
timestamps:true
});

const Favorite = mongoose.model(
"Favorite",
favoriteSchema
);

/* =========================
ADD FAVORITE
========================= */

app.post(
"/api/favorites/:catId",
protect,
async (req,res)=>{

try{

const exists = await Favorite.findOne({

userId:req.user._id,

catId:req.params.catId

});

if(exists){

return res.status(400).json({
success:false,
message:"Already favorited"
});

}

const favorite = await Favorite.create({

userId:req.user._id,

catId:req.params.catId

});

res.json({
success:true,
favorite
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

}
);

/* =========================
GET FAVORITES
========================= */

app.get(
"/api/favorites",
protect,
async (req,res)=>{

try{

const favorites = await Favorite.find({

userId:req.user._id

}).populate("catId");

res.json({
success:true,
count:favorites.length,
favorites
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

}
);

/* =========================
REMOVE FAVORITE
========================= */

app.delete(
"/api/favorites/:catId",
protect,
async (req,res)=>{

try{

await Favorite.findOneAndDelete({

userId:req.user._id,

catId:req.params.catId

});

res.json({
success:true,
message:"Favorite removed"
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

}
);

/* =========================
GET ALL USERS
========================= */

app.get(
"/api/admin/users",
protect,
adminOnly,
async (req,res)=>{

try{

const users = await User.find()
.select("-password");

res.json({
success:true,
count:users.length,
users
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

}
);
/* =========================
BAN USER
========================= */

app.put(
"/api/admin/ban/:id",
protect,
adminOnly,
async (req,res)=>{

try{

const user =
await User.findById(
req.params.id
);

if(!user){

return res.status(404).json({
success:false,
message:"User not found"
});

}

if(user.role === "admin"){

return res.status(400).json({
success:false,
message:"Cannot ban admin"
});

}

user.status = "banned";

await user.save();

res.json({
success:true,
message:"User banned"
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
UNBAN USER
========================= */

app.put(
"/api/admin/unban/:id",
protect,
adminOnly,
async (req,res)=>{

try{

await User.findByIdAndUpdate(
req.params.id,
{
status:"active"
}
);

res.json({
success:true,
message:"User unbanned"
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});
/* =========================
VERIFY USER
========================= */

app.put(
"/api/admin/verify-user/:id",
protect,
adminOnly,
async (req,res)=>{

try{

await User.findByIdAndUpdate(
req.params.id,
{
verified:true
}
);

res.json({
success:true,
message:"User verified"
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

}
);

/* =========================
DELETE USER
========================= */

app.delete(
"/api/admin/users/:id",
protect,
adminOnly,
async (req,res)=>{

try{

const user =
await User.findById(
req.params.id
);

if(!user){

return res.status(404).json({
success:false,
message:"User not found"
});

}

if(user.role === "admin"){

return res.status(400).json({
success:false,
message:"Cannot delete admin"
});

}

/* Remove favorites created by user */

await Favorite.deleteMany({
userId:user._id
});

/* Remove favorites on user's cats */

await Favorite.deleteMany({
catId:{
$in:(await Cat.find({
ownerId:user._id
})).map(cat=>cat._id)
}
});

/* Remove reports */

await Report.deleteMany({
ownerId:user._id
});

await Report.deleteMany({
reporterId:user._id
});

/* Remove user's cats */

await Cat.deleteMany({
ownerId:user._id
});

/* Remove user */

await User.findByIdAndDelete(
user._id
);

res.json({
success:true,
message:"User deleted"
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});


/* =========================
DELETE ANY CAT
========================= */

app.delete(
"/api/admin/cats/:id",
protect,
adminOnly,
async (req,res)=>{

try{

await Favorite.deleteMany({
catId:req.params.id
});

const cat =
await Cat.findByIdAndDelete(
req.params.id
);

if(cat){

await Report.deleteMany({
targetId:cat._id.toString()
});

}

res.json({
success:true,
message:"Cat deleted by admin"
});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});

/* =========================
ADMIN DASHBOARD
========================= */

app.get(
"/api/admin/dashboard",
protect,
adminOnly,
async (req,res)=>{

try{

const totalUsers =
await User.countDocuments({
role:"user"
});

const totalCats =
await Cat.countDocuments();

const availableCats =
await Cat.countDocuments({
status:"available"
});

const adoptedCats =
await Cat.countDocuments({
status:"adopted"
});

const totalReports =
await Report.countDocuments();

const pendingReports =
await Report.countDocuments({
status:"pending"
});

const bannedUsers =
await User.countDocuments({
status:"banned"
});

res.json({

success:true,

totalUsers,

totalCats,

availableCats,

adoptedCats,

totalReports,

pendingReports,

bannedUsers

});

}catch(error){

res.status(500).json({
success:false,
message:error.message
});

}

});
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
