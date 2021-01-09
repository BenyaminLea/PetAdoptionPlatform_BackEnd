const { body, validationResult } = require("express-validator");

const validateUserSignup = [
  body("email").isEmail(),
  body("firstName").exists(),
  body("firstName").isLength({ min: 1 }),
  body("lastName").exists(),
  body("lastName").isLength({ min: 1 }),
  body("phone").exists(),
  body("phone").isLength({ min: 10, max: 10 }),
  body("password1").isLength({ min: 8 }),
  body("password1").exists(),
  body("password2").custom((value, { req }) => {
    if (value !== req.body.password1) {
      throw new Error("Password confirmation does not match password");
    }
    return true;
  }),
];

const validateUserChange = [
  body("email").isEmail(),
  body("firstName").exists(),
  body("firstName").isLength({ min: 1 }),
  body("lastName").exists(),
  body("lastName").isLength({ min: 1 }),
  body("phone").exists(),
  body("phone").isLength({ min: 10, max: 10 }),
  body("password").isLength({ min: 8 }),
  body("password").exists(),
];
const validateAddPet = [
  body("name").exists(),
  body("name").isLength({ min: 1 }),
  body("height").exists(),
  body("height").isNumeric(),
  body("weight").exists(),
  body("weight").isNumeric(),
  body("color").exists(),
  body("color").isLength({ min: 1 }),
  body("breed").exists(),
  body("breed").isLength({ min: 1 }),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    next();
  } else {
    let message = "";
    for (let k = 0; k < errors.array().length; k++) {
      message =
        message +
        errors.array()[k].msg +
        " for " +
        errors.array()[k].param +
        ". ";
    }
    res.json({ loggedIn: false, message: message });
  }
};

const handleValidationUserChange = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    next();
  } else {
    let message = "";
    for (let k = 0; k < errors.array().length; k++) {
      message =
        message +
        errors.array()[k].msg +
        " for " +
        errors.array()[k].param +
        ". ";
    }
    res.json({ message: message });
  }
};

module.exports = {
  validateUserSignup,
  validateAddPet,
  validateUserChange,
  handleValidationErrors,
  handleValidationUserChange,
};
