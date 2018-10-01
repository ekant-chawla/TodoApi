const mongoose = require('mongoose');
const Schema = mongoose.Schema;


let ToDoModel = new Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    description: { type: String },
    title: { type: String, required: true },
    createdOn: { type: Date, default: Date.now },
    completed: { type: Boolean, default: false }
})


mongoose.model('ToDo', ToDoModel);