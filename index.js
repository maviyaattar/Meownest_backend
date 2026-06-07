require("dotenv").config();

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

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = await User.findById(decoded.id).select("-password");

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

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

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const match = await bcrypt.compare(
      password,
      user.password
    );

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (user.status === "banned") {
      return res.status(403).json({
        success: false,
        message: "Account banned",
      });
    }

    res.json({
      success: true,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/* =========================
   PROFILE
========================= */

app.get("/api/auth/profile", protect, async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

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
"name username city avatar phone whatsapp"
)
.sort({createdAt:-1});

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
GET SINGLE CAT
========================= */

app.get("/api/cats/:id", async (req,res)=>{

try{

const cat = await Cat.findById(req.params.id)
.populate(
"ownerId",
"name username city avatar phone whatsapp bio"
);

if(!cat){

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
