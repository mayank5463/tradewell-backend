const { Schema, model } = require("mongoose");

// User schema — stores name, email and hashed password
// We NEVER store plain text passwords
const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true, // no two users with same email
      lowercase: true, // always store email in lowercase
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  },
);

const UserModel = model("User", UserSchema);

module.exports = { UserSchema, UserModel };
