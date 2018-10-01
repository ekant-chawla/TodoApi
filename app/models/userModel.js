const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let userModel = new Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, default: '' },
    userId: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    signUpDate: { type: Date, default: Date.now },
    email: { type: String, required: true },
    passwordResetToken: { type: String, default: '' },
    friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    country: { type: Object, required: true },
    phone: { type: String, required: true }
})


mongoose.model('User', userModel);