const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let NotificationModel = new Schema({
    type: { type: String, required: true, enum: ['friend-request', 'friend-add', 'todo-create', 'todo-update', 'todo-create-item', 'todo-update-item'] },
    userId: { type: String, required: true },
    targetId: { type: String, required: true }, // todo id or friend id based on the type.
    message: { type: String, required: true },
    title: { type: String, required: true },
    sentOn: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
})


mongoose.model('Notification', NotificationModel);