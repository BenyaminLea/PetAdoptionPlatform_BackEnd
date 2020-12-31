const express = require("express");
const app = express();
const port = 5000;
const fs = require("fs");
var cors = require("cors");
const multer = require("multer");
const path = require("path");

const bcrypt = require("bcrypt");
const saltRounds = 10;
require("dotenv").config();
const { createToken, verifyToken } = require("./auth");

const { MongoClient, ObjectID } = require("mongodb");
const url = process.env.URL;
const client = new MongoClient(url, { useUnifiedTopology: true });
const dbName = "petAdoptionPlatform";
let users_collection = "";

client.connect().then((response) => {
  if (response.topology.s.state) {
    console.log("Status: " + response.topology.s.state);
    const db = client.db(dbName);
    // Use the collection named "users"
    users_collection = db.collection("users");
    pets_collection = db.collection("pets");
  } else {
    console.log("Problem connecting to MongoDB");
  }
});

const storage = multer.diskStorage({
  destination: "./public/images",
  filename: (req, file, cb) => {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

app.use(cors());

const upload = multer({ storage });

const {
  validateUserSignup,
  validateAddPet,
  handleValidationErrors,
} = require("./validator");

app.use(express.json());
app.use(express.static("public"));
app.post(
  "/api/signup",
  validateUserSignup,
  handleValidationErrors,
  (req, res) => {
    try {
      one_db_user = users_collection
        .findOne({
          email: req.body.email,
        })
        .then((user) => {
          if (user) {
            res.json({
              loggedIn: false,
              message: "Email already used",
            });
          } else {
            try {
              const userObject = req.body;
              delete userObject.password2;
              let password = userObject.password1;
              delete userObject.password1;
              bcrypt.hash(password, saltRounds, async (err, hash) => {
                userObject["password"] = hash;
                if (err) {
                  console.log(err);
                } else {
                  newUserDB = users_collection.insertOne(userObject);
                  newUserDB.then((response) => {
                    const id = response.ops[0]._id;
                    const token = createToken(id);
                    res.json({ loggedIn: true, token: token });
                  });
                }
              });
            } catch (err) {
              res.send(
                `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
              );
            }
          }
        });
    } catch (error) {
      res.send(
        `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
      );
    }
  }
);

app.post("/api/pet", upload.single("picture"), (req, res) => {
  try {
    const pet = JSON.parse(req.body.data);
    const imagePath = `images/${req.file.filename}`;
    const petObject = { ...pet, picture: imagePath };
    newPetDB = pets_collection.insertOne(petObject);
    newPetDB.then(res.send("Pet added to database."));
  } catch (err) {
    res.send(
      `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
    );
  }
});

app.post("/api/login", (req, res) => {
  try {
    one_db_user = users_collection
      .findOne({
        email: req.body.email,
      })
      .then((user) => {
        if (user) {
          bcrypt.compare(req.body.password, user.password, (err, response) => {
            if (response) {
              const id = user._id;
              const token = createToken(id);
              res.json({ loggedIn: true, token: token });
            } else {
              res.json({
                loggedIn: false,
                message: "Email and password don't match",
              });
            }
          });
        } else {
          res.json({ loggedIn: false, message: "User not found" });
        }
      });
  } catch (error) {
    res.send(
      `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
    );
  }
});

// GET PART

app.get("/api/login", async (req, res) => {
  if (req.headers.authorization) {
    const token = req.headers.authorization.split(" ")[1];
    const id = await verifyToken(token);
    if (id) {
      try {
        one_db_user = users_collection
          .findOne({
            _id: ObjectID(id),
          })
          .then((user) => {
            if (user) {
              res.json({ loggedIn: true, user: user });
            } else {
              res.json({ loggedIn: false });
            }
          });
      } catch (error) {
        res.send(
          `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
        );
      }
    } else {
      res.json({ loggedIn: false });
    }
  } else {
    res.json({ loggedIn: false });
  }
});

app.get("/api/user/:id", (req, res) => {
  const { id } = req.params;
  try {
    one_db_user = users_collection
      .findOne({
        _id: ObjectID(id),
      })
      .then((user) => {
        res.json(user || {});
      });
  } catch (error) {
    res.send(
      `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
    );
  }
});

app.get("/api/user", (req, res) => {
  try {
    all_db_users = users_collection
      .find()
      .toArray()
      .then((users) => {
        console.log(users);
        res.json(users);
      });
  } catch (err) {
    res.send(
      `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
    );
  }
});

app.get("/api/pet/:id", (req, res) => {
  const { id } = req.params;
  try {
    one_db_pet = pets_collection
      .findOne({
        _id: ObjectID(id),
      })
      .then((pet) => {
        res.json(pet || {});
      });
  } catch (error) {
    res.send(
      `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
    );
  }
});

app.get("/api/pet", (req, res) => {
  const search = Object.keys(req.query)[0];
  if (req.query[search].length === 0) {
    try {
      all_db_pets = pets_collection
        .find()
        .toArray()
        .then((pets) => {
          res.json(pets);
        });
    } catch (err) {
      res.send(
        `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
      );
    }
  } else {
    try {
      filtered_db_pets = pets_collection
        .find({ [search]: { $eq: req.query[search] } })
        .toArray()
        .then((pets) => {
          res.json(pets);
        });
    } catch (err) {
      res.send(
        `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
      );
    }
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
