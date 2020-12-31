const jwt = require("jsonwebtoken");
require("dotenv").config();
const secretTokenKey = process.env.SECRET_TOKEN_KEY;

const createToken = (id) => {
  return jwt.sign({ id }, secretTokenKey);
};

const verifyToken = async (token) => {
  try {
    const payload = await jwt.verify(token, secretTokenKey);
    return payload.id;
  } catch (err) {
    return null;
  }
};

module.exports = { createToken, verifyToken };
