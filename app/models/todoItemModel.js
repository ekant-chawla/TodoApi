const mongoose = require('mongoose');
const Schema = mongoose.Schema;


let ToDoItemModel = new Schema({
    id: { type: String, required: true },
    userId: { type: String, required: true },
    todoId: { type: String, required: true },
    parentItemId: { type: String, default: '' },// if '' it means it has not parent item
    title: { type: String, required: true },
    updatedOn: { type: Date, default: Date.now },
    completed: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
    changeMessage:{type:String,default:''}
})


mongoose.model('ToDoItem', ToDoItemModel);