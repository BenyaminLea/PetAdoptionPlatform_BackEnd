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
  fileFilter: function (req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      cb(null, false);
    }
    cb(null, true);
  },
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
  validateUserChange,
  handleValidationErrors,
  handleValidationUserChange,
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
              userObject["isAdmin"] = false;
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

app.post("/api/pet/:id/adopt", (req, res) => {
  const { id } = req.params;
  const oldPets = req.body.user.pets;
  const tempPets = [];
  let newPets = [];
  let isAlreadyFostered = false;
  if (req.body.type === "adopt") {
    req.body.pet.adoptionStatus = "adopted";
    for (let i = 0; i < oldPets.length; i++) {
      if (oldPets[i]._id !== id) {
        tempPets.push(oldPets[i]);
      } else {
        isAlreadyFostered = true;
      }
    }
  } else {
    req.body.pet.adoptionStatus = "fostered";
  }
  if (isAlreadyFostered) {
    newPets = [...tempPets, req.body.pet];
  } else {
    if (oldPets.length === 0) {
      newPets = [req.body.pet];
    } else {
      newPets = [...oldPets, req.body.pet];
    }
  }
  let result = { user: {}, pet: {} };
  try {
    updated_user = users_collection.findOneAndUpdate(
      {
        _id: ObjectID(req.body.user._id),
      },
      { $set: { pets: newPets } },
      { returnOriginal: false }
    );
    updated_user.then((response) => (result.user = response.value));
    if (req.body.type === "adopt") {
      updated_pet = pets_collection.findOneAndUpdate(
        {
          _id: ObjectID(id),
        },
        { $set: { adoptionStatus: "adopted", userId: req.body.user._id } },
        { returnOriginal: false }
      );
      updated_pet.then((response) => {
        result.pet = response.value;
        res.json(result);
      });
    } else {
      updated_pet = pets_collection.findOneAndUpdate(
        {
          _id: ObjectID(id),
        },
        { $set: { adoptionStatus: "fostered", userId: req.body.user._id } },
        { returnOriginal: false }
      );
      updated_pet.then((response) => {
        result.pet = response.value;
        res.json(result);
      });
    }
  } catch (error) {
    res.send(
      `We have error: ${error.stack}. Sorry. We appreciate your patience while we work this out.`
    );
  }
});

app.post("/api/pet/:id/return", (req, res) => {
  const { id } = req.params;
  const oldPets = req.body.user.pets;
  const newPets = [];
  for (let i = 0; i < oldPets.length; i++) {
    if (oldPets[i]._id !== id) {
      newPets.push(oldPets[i]);
    }
  }
  let result = { user: {}, pet: {} };
  try {
    updated_user = users_collection.findOneAndUpdate(
      {
        _id: ObjectID(req.body.user._id),
      },
      { $set: { pets: newPets } },
      { returnOriginal: false }
    );
    updated_user.then((response) => (result.user = response.value));
    updated_pet = pets_collection.findOneAndUpdate(
      {
        _id: ObjectID(id),
      },
      { $set: { adoptionStatus: "available", userId: "" } },
      { returnOriginal: false }
    );
    updated_pet.then((response) => {
      result.pet = response.value;
      res.json(result);
    });
  } catch (error) {
    res.send(
      `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
    );
  }
});

app.post("/api/pet/:id/save", (req, res) => {
  const { id } = req.params;
  const oldPetsSaved = req.body.user.petsSaved;
  let newPetsSaved = [];
  if (oldPetsSaved.length === 0) {
    newPetsSaved = [req.body.pet];
  } else {
    newPetsSaved = [...oldPetsSaved, req.body.pet];
  }
  try {
    users_collection
      .findOneAndUpdate(
        {
          _id: ObjectID(req.body.user._id),
        },
        { $set: { petsSaved: newPetsSaved } },
        { returnOriginal: false }
      )
      .then((response) => {
        res.json({ user: response.value });
      });
  } catch (err) {
    res.send(
      `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
    );
  }
});

app.delete("/api/pet/:id/save", (req, res) => {
  const { id } = req.params;
  const oldPets = req.body.user.petsSaved;
  const newPets = [];
  for (let i = 0; i < oldPets.length; i++) {
    if (oldPets[i]._id !== id) {
      newPets.push(oldPets[i]);
    }
  }
  try {
    users_collection
      .findOneAndUpdate(
        {
          _id: ObjectID(req.body.user._id),
        },
        { $set: { petsSaved: newPets } },
        { returnOriginal: false }
      )
      .then((response) => {
        res.json({ user: response.value });
      });
  } catch (error) {
    res.send(
      `We have error: ${error.stack}. Sorry. We appreciate your patience while we work this out.`
    );
  }
});

app.put(
  "/api/user/:id",
  validateUserChange,
  handleValidationErrors,
  (req, res) => {
    try {
      one_db_user = users_collection
        .findOne({
          email: req.body.email,
        })
        .then((user) => {
          if (user._id != ObjectID(req.body._id)) {
            res.json({
              message: "Email already used",
            });
          } else {
            try {
              const userObject = req.body;
              bcrypt.hash(
                userObject.password,
                saltRounds,
                async (err, hash) => {
                  userObject.password = hash;
                  if (err) {
                    console.log(err);
                  } else {
                    updatedUserDB = users_collection.updateOne(
                      { _id: ObjectID(userObject._id) },
                      userObject
                    );
                    updatedUserDB.then((response) => {
                      res.json({ message: "User infos updated" });
                    });
                  }
                }
              );
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

app.put("/api/pet/photo/:id", upload.single("picture"), (req, res) => {
  try {
    const pet = JSON.parse(req.body.data);
    const imagePath = `images/${req.file.filename}`;
    pet.picture = imagePath;
    pet._id = ObjectID(pet._id);
    updatedPet = pets_collection.replaceOne({ _id: pet._id }, pet);
    updatedPet.then(() => {
      res.send("Pet updated");
    });
  } catch (err) {
    res.send(
      `We have error: ${err.stack}. Sorry. We appreciate your patience while we work this out.`
    );
  }
});

app.put("/api/pet/:id", (req, res) => {
  try {
    const pet = JSON.parse(req.body);
    pet._id = ObjectID(pet._id);
    updatedPet = pets_collection.replaceOne({ _id: pet._id }, pet);
    updatedPet.then(() => {
      res.send("Pet updated");
    });
  } catch (err) {
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

app.get("/api/pet/user/:id", (req, res) => {
  const { id } = req.params;
  try {
    one_db_user = users_collection
      .findOne({
        _id: ObjectID(id),
      })
      .then((user) => {
        res.json({ saved: user.petsSaved, adopted: user.pets } || {});
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
