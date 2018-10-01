const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let RequestModel = new Schema({
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
    sender: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    receiver: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    status: { type: Number, enum: [0, 1], default: 0 }, // 0 = pending 1 = accepted
    sentOn: { type: Date, default: Date.now },
})


mongoose.model('Request', RequestModel);