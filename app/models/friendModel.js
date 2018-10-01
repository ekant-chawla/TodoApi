const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let FriendModel = new Schema({
    userId: { type: String, required: true },
    friendId: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    friend: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    addedOn: { type: Date, default: Date.now },
})


mongoose.model('Friend', FriendModel);