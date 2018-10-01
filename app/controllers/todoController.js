const mongoose = require('mongoose')
const logger = require('./../libs/loggerLib')
const response = require('./../libs/responseLib')
const shortId = require('short-id')
const eventEmitter = require('./../libs/eventLib').eventEmitter
const config = require('./../../config/appConfig')
const notificationController = require('./notificationController')

const UserModel = mongoose.model('User')
const FriendModel = mongoose.model('Friend')
const ToDoModel = mongoose.model('ToDo')
const ToDoItemModel = mongoose.model('ToDoItem');


let listToDo = function (req, res) {

    if (!req.body.userId) {
        req.body.userId = req.user.userId
    } // if no user id is provided then return the calling user's list

    if (!req.body.page || req.body.page == 0 || req.body.page < 0) req.body.page = 0
    else req.body.page -= 1

    if (!req.body.timestamp) req.body.timestamp = Date.now()


    let verifyIsAFriend = function () {

        return new Promise((resolve, reject) => {

            if (req.body.userId == req.user.userId) resolve()

            FriendModel.findOne({ userId: req.user.userId, friendId: req.body.userId })
                .lean()
                .exec((err, result) => {
                    if (err) {
                        logger.error(err.message, 'Todo Controller: verifyIsAFriend', 5)
                        let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                        reject(apiResponse)
                    } else if (result) {
                        resolve()
                    } else {
                        let apiResponse = response.generate(true, 'You are not friends with this user.', 403, null)
                        reject(apiResponse)
                    }
                })
        })

    }

    verifyIsAFriend()
        .then(() => {
            ToDoModel.find({ userId: req.body.userId })
                .where('createdOn').lte(req.body.timestamp)
                .lean()
                .sort("-createdOn")
                .select("-_id completed id title description")
                .skip((req.body.page) * config.pageSize)
                .limit(config.pageSize)
                .exec((err, result) => {

                    if (err) {
                        logger.error(err.message, 'Todo Controller: listTodo', 5)
                        let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                        res.send(apiResponse)
                    } else {
                        let apiResponse = response.generate(false, 'Listing Todo', 200, result)
                        res.send(apiResponse)
                    }

                })
        })
        .catch((apiResponse) => {
            res.send(apiResponse)
        })



}

let createToDo = function (req, res) {

    let todo = new ToDoModel({
        id: shortId.generate(),
        userId: req.user.userId,
        description: req.body.description,
        title: req.body.title
    })

    todo.save((err, result) => {

        if (err) {
            let apiResponse
            logger.error(err.message, 'Todo Controller: createToDo', 5)
            if (err.name = "ValidationError") {
                apiResponse = response.generate(true, err.message, 403, null)
            } else {
                apiResponse = response.generate(true, "Internal server error.", 500, null)
            }
            res.send(apiResponse)
        } else {
            result = result.toObject()
            delete result._id
            delete result.__v
            delete result.createdOn
            delete result.userId
            let apiResponse = response.generate(false, 'Todo created successfully', 200, result)
            res.send(apiResponse)


            //send notification to all users

            notificationController.sendNotification({
                userId: req.user.userId,
                senderId: req.user.userId,
                title: "New Todo",
                message: `Your friend ${req.user.firstName} created a new todo.`,
                notificationType: 'todo-create',
                targetId: todo.todoId,
                todo: result,
                eventName: 'todo-notification'

            })

        }
    })


}

let createToDoItem = function (req, res) {

    if (!req.body.parentItemId) req.body.parentItemId = ''

    let verifyUserInput = function () {
        return new Promise((resolve, reject) => {
            if (!req.body.title || req.body.title.trim() == '' || !req.body.todoId) {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing todo item title or todo id.', 403, null)
                reject(apiResponse)
            } else {
                resolve()
            }
        })
    }

    let verifyToDoExists = function () {
        if (req.body.parentItemId == '') {

            return new Promise((resolve, reject) => {
                ToDoModel.findOne({ id: req.body.todoId })
                    .lean()
                    .exec((err, result) => {
                        if (err) {
                            logger.error(err.message, 'Todo Controller: verifyToDoExists', 5)
                            let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                            reject(apiResponse)
                        } else if (result) {
                            if (result.userId != req.user.userId) {
                                let apiResponse = response.generate(true, 'Only the owner of the todo can create items.', 404, null)
                                reject(apiResponse)
                            } else if (result.completed) {
                                let apiResponse = response.generate(true, 'Cannot add items to a completed todo.', 403, null)
                                reject(apiResponse)
                            } else resolve()
                        } else {
                            let apiResponse = response.generate(true, 'No such todo found.', 404, null)
                            reject(apiResponse)
                        }
                    })
            })

        } else {

            return new Promise((resolve, reject) => {
                ToDoItemModel.findOne({ todoId: req.body.todoId, id: req.body.parentItemId })
                    .sort('-updatedOn')
                    .lean()
                    .exec((err, result) => {
                        if (err) {
                            logger.error(err.message, 'Todo Controller: verifyToDoExists', 5)
                            let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                            reject(apiResponse)
                        } else if (result) {
                            if (result.userId != req.user.userId) {
                                let apiResponse = response.generate(true, 'Only the owner of the todo can create items.', 403, null)
                                reject(apiResponse)
                            }
                            else if (result.completed) {
                                let apiResponse = response.generate(true, 'Cannot add sub-items to already completed items.', 403, null)
                                reject(apiResponse)
                            } else if (result.deleted) {
                                let apiResponse = response.generate(true, 'Cannot add sub-items to deleted items.', 403, null)
                                reject(apiResponse)
                            }
                            else resolve()
                        } else {
                            let apiResponse = response.generate(true, 'No such todo item found.', 404, null)
                            reject(apiResponse)
                        }
                    })
            })

        }
    }

    let createTodoItemAndSave = function () {

        let message = `A new item ${req.body.title} added to todo with id ${req.body.todoId} by ${req.user.firstName}.`

        let todoItem = new ToDoItemModel({
            title: req.body.title,
            id: shortId.generate(),
            userId: req.user.userId,
            todoId: req.body.todoId,
            parentItemId: req.body.parentItemId,
            changeMessage: message
        })

        todoItem.save((err, result) => {
            if (err) {
                let apiResponse
                logger.error(err.message, 'Todo Controller: createToDoItemAndSave', 5)
                if (err.name = "ValidationError") {
                    apiResponse = response.generate(true, err.message, 403, null)
                } else {
                    apiResponse = response.generate(true, "Internal server error.", 500, null)
                }
                res.send(apiResponse)
            } else {

                result = result.toObject()
                delete result._id
                delete result.__v
                delete result.updatedOn
                delete result.userId
                delete result.changeMessage
                let apiResponse = response.generate(false, 'Todo item created successfully', 200, result)
                res.send(apiResponse)
                //send notification to all users and save in db
                notificationController.sendNotification({
                    userId: req.user.userId,
                    senderId: req.user.userId,
                    title: "New Todo Item",
                    message: message,
                    notificationType: 'todo-create-item',
                    targetId: todoItem.todoId,
                    todo: result,
                    eventName: 'todo-notification'
                })
            }

        })

    }

    verifyUserInput().then(verifyToDoExists).then(createTodoItemAndSave).catch(apiResponse => { res.send(apiResponse) })

}

//return a list of all todo items. even if deleted or completed.
let listTodoItem = function (req, res) {

    let _todo

    if (!req.body.parentItemId) req.body.parentItemId = ''

    let verifyUserInput = function () {
        return new Promise((resolve, reject) => {
            if (!req.body.todoId) {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing todo id.', 403, null)
                reject(apiResponse)
            } else {
                resolve()
            }
        })
    }

    let verifyToDoExists = function () {
        if (req.body.parentItemId == '') {
            return new Promise((resolve, reject) => {
                ToDoModel.findOne({ id: req.body.todoId })
                    .select('-_id -__v -createdOn')
                    .lean()
                    .exec((err, result) => {
                        if (err) {
                            logger.error(err.message, 'Todo Controller: verifyToDoExists', 5)
                            let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                            reject(apiResponse)
                        } else if (result) {
                            _todo = result
                            resolve(result)
                        } else {
                            let apiResponse = response.generate(true, 'No such todo found.', 404, null)
                            reject(apiResponse)
                        }
                    })
            })

        } else {
            return new Promise((resolve, reject) => {
                ToDoItemModel.findOne({ todoId: req.body.todoId, id: req.body.parentItemId })
                    .sort('-updatedOn')
                    .select('-_id -__v -updatedOn -changeMessage')
                    .lean()
                    .exec((err, result) => {
                        if (err) {
                            logger.error(err.message, 'Todo Controller: verifyToDoExists', 5)
                            let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                            reject(apiResponse)
                        } else if (result) {
                            if (result.deleted) {
                                let apiResponse = response.generate(true, 'Cannot query deleted items.', 403, null)
                                reject(apiResponse)
                            } else {
                                _todo = result
                                resolve(result)
                            }
                        } else {
                            let apiResponse = response.generate(true, 'No such todo item found.', 404, null)
                            reject(apiResponse)
                        }
                    })
            })

        }
    }

    let verifyPermission = function (todo) {
        return new Promise((resolve, reject) => {
            if (req.user.userId == todo.userId) resolve()
            FriendModel.findOne({ userId: req.user.userId, friendId: todo.userId }).lean().exec((err, result) => {
                if (err) {
                    logger.error(err.message, 'Todo Controller: verifyPermission', 5)
                    let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                    reject(apiResponse)
                } else if (result) {
                    resolve()
                } else {
                    let apiResponse = response.generate(true, 'You are not friend of the owner of this todo.', 403, null)
                    reject(apiResponse)
                }
            })
        })
    }

    let listItems = function () {
        ToDoItemModel.aggregate([
            {
                $sort: {
                    updatedOn: 1
                }
            },
            {
                $group: {
                    _id: '$id',
                    todoId: { $last: '$todoId' },
                    parentItemId: { $last: '$parentItemId' },
                    completed: { $last: '$completed' },
                    deleted: { $last: '$deleted' },
                    title: { $last: '$title' },
                }
            },
            {
                $match: { todoId: req.body.todoId, parentItemId: req.body.parentItemId, deleted: false }
            },
            {
                $project: {
                    id: '$_id',
                    todoId: '$todoId',
                    parentItemId: '$parentItemId',
                    completed: '$completed',
                    deleted: '$deleted',
                    title: '$title',
                }
            }
        ]).exec((err, result) => {

            _todo.list = result
            if (err) {
                logger.error(err.message, 'Todo Controller: listItems', 5)
                let apiResponse = response.generate(true, 'Internal server error', 500, null)
                reject(apiResponse)
            }
            else {
                let apiResponse = response.generate(false, 'Todo item list.', 200, _todo)
                res.send(apiResponse)
            }
        })
    }

    verifyUserInput().then(verifyToDoExists).then(verifyPermission).then(listItems).catch(apiResponse => { res.send(apiResponse) })


}

let markTodoComplete = function (req, res) {

    let verifyUserInput = function () {
        return new Promise((resolve, reject) => {
            if (!req.body.todoId) {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing todo id.', 403, null)
                reject(apiResponse)
            } else {
                resolve()
            }
        })
    }

    let verifyToDoExists = function () {
        return new Promise((resolve, reject) => {
            ToDoModel.findOne({ id: req.body.todoId })
                .lean()
                .exec((err, result) => {
                    if (err) {
                        logger.error(err.message, 'Todo Controller: verifyToDoExists', 5)
                        let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                        reject(apiResponse)
                    } else if (result) {
                        if (result.deleted) {
                            let apiResponse = response.generate(true, 'Cannot updated deleted todo.', 403, null)
                            reject(apiResponse)
                        } else if (result.completed) {
                            let apiResponse = response.generate(true, 'Todo already marked as completed.', 403, null)
                            reject(apiResponse)
                        } else if (result.userId != req.user.userId) {
                            let apiResponse = response.generate(true, 'Only the owner of the todo can mark it complete.', 404, null)
                            reject(apiResponse)
                        }
                        else resolve()
                    } else {
                        let apiResponse = response.generate(true, 'No such todo found.', 404, null)
                        reject(apiResponse)
                    }
                })
        })
    }

    let verifyOpenItems = function () {
        return new Promise((resolve, reject) => {

            ToDoItemModel.aggregate([
                {
                    $sort: {
                        updatedOn: 1
                    }
                },
                {
                    $group: {
                        _id: '$id',
                        completed: { $last: '$completed' },
                        deleted: { $last: '$deleted' },
                        todoId: { $last: '$todoId' },
                        parentItemId: { $last: '$parentItemId' },
                    }
                }, {
                    $match: { todoId: req.body.todoId, parentItemId: '', deleted: false, completed: false } // Get those items which are neither completed or deleted
                }
            ]).exec((err, result) => {
                if (err) {
                    logger.error(err.message, 'Todo Controller: verifyOpenItems', 5)
                    let apiResponse = response.generate(true, 'Internal server error.', 500, null)
                    reject(apiResponse)
                }
                else {


                    if (result && result.length > 0) {
                        let apiResponse = response.generate(true, `This todo still has ${result.length} open items. Close or delete all items before closing the todo.`, 403, null)
                        reject(apiResponse)
                    } else resolve()
                }
            })
        })
    }

    let markComplete = function () {
        ToDoModel.updateOne({ id: req.body.todoId, completed: false }, { completed: true }).exec((err, result) => {
            if (err) {
                console.log(err)
                let apiResponse = response.generate(true, 'Internal server error.', 500, null)
                res.send(apiResponse)
            } else {
                let apiResponse
                if (result.nModified == 0) {
                    apiResponse = response.generate(true, 'Todo is already marked completed. Failed to update.', 200, null)
                    res.send(apiResponse)
                } else {
                    apiResponse = response.generate(false, 'Todo updated to be closed.', 200, { userId: req.user.userId, todoId: req.body.todoId, completed: true })
                    res.send(apiResponse)

                    notificationController.sendNotification({
                        userId: req.user.userId,
                        senderId: req.user.userId,
                        title: "Todo closed",
                        message: `Your friend ${req.user.firstName} clsoed todo with id ${req.body.todoId}.`,
                        notificationType: 'todo-update',
                        targetId: req.body.todoId,
                        todo: { userId: req.user.userId, todoId: req.body.todoId, completed: true },
                        eventName: 'todo-notification'

                    })
                }
            }
        })
    }

    verifyUserInput().then(verifyToDoExists).then(verifyOpenItems).then(markComplete).catch(apiResponse => { res.send(apiResponse) })



}

let markTodoInComplete = function (req, res) {

    let verifyUserInput = function () {
        return new Promise((resolve, reject) => {
            if (!req.body.todoId) {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing todo id.', 403, null)
                reject(apiResponse)
            } else {
                resolve()
            }
        })
    }

    let markIncomplete = function () {

        ToDoModel.updateOne({ id: req.body.todoId, completed: true, userId: req.user.userId }, { completed: false }).exec((err, result) => {
            if (err) {
                console.log(err)
                let apiResponse = response.generate(true, 'Internal server error.', 500, null)
                res.send(apiResponse)
            } else {
                let apiResponse
                if (result.nModified == 0) {
                    apiResponse = response.generate(true, 'Todo is already marked incompleted or you are not owner of this todo.', 404, null)
                    res.send(apiResponse)
                } else {
                    apiResponse = response.generate(false, 'Todo updated to be open.', 200, { userId: req.user.userId, todoId: req.body.todoId, completed: false })
                    res.send(apiResponse)

                    notificationController.sendNotification({
                        userId: req.user.userId,
                        senderId: req.user.userId,
                        title: "Todo Re-opened",
                        message: `Your friend ${req.user.firstName} reopened todo with id ${req.body.todoId}.`,
                        notificationType: 'todo-update',
                        targetId: req.body.todoId,
                        todo: { userId: req.user.userId, todoId: req.body.todoId, completed: false },
                        eventName: 'todo-notification'

                    })
                }
            }
        })
    }


    verifyUserInput().then(markIncomplete).catch(apiResponse => { res.send(apiResponse) })

}

let markItemDeleted = function (req, res) {

    let verifyUserInput = function () {
        return new Promise((resolve, reject) => {
            if (!req.body.todoId && !req.body.itemId) {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing todo id or target item id.', 403, null)
                reject(apiResponse)
            } else {
                resolve()
            }
        })
    }

    let verifyToDoItemExists = function () {
        return new Promise((resolve, reject) => {
            ToDoItemModel.findOne({ id: req.body.itemId, todoId: req.body.todoId }).lean().sort('-updatedOn').select('-_id -__v -updatedOn').exec((err, result) => {
                if (err) {
                    let apiResponse = response.generate(true, 'Internal server error.', 500, null)
                    reject(apiResponse)
                } else if (result) {
                    if (result.deleted) {
                        let apiResponse = response.generate(true, 'Item already deleted.', 403, null)
                        reject(apiResponse)
                    } else resolve(result)
                } else {
                    let apiResponse = response.generate(true, 'No such todo item exists.', 404, null)
                    reject(apiResponse)
                }

            })
        })
    }

    let verifyPermission = function (todo) {

        return new Promise((resolve, reject) => {
            if (todo.userId == req.user.userId) resolve(todo)

            FriendModel.findOne({ userId: todo.userId, friendId: req.user.userId })
                .lean()
                .exec((err, result) => {
                    if (err) {
                        let apiResponse = response.generate(true, 'Internal server error.', 500, null)
                        reject(apiResponse)
                    } else if (result) {
                        resolve(todo)
                    } else {
                        let apiResponse = response.generate(true, 'Only the owner and his friends can update todo items.', 403, null)
                        reject(apiResponse)
                    }
                })
        })
    }

    let saveItem = function (todo) {

        todo.deleted = true
        todo.changeMessage = `${req.user.firstName} deleted the todo item ${req.body.itemId} from todo ${req.body.todoId}`
        let todoItem = new ToDoItemModel(todo)

        todoItem.save((err, result) => {

            if (err) {
                let apiResponse
                logger.error(err.message, 'Todo Controller: saveItem', 5)
                if (err.name = "ValidationError") {
                    apiResponse = response.generate(true, err.message, 403, null)
                } else {
                    apiResponse = response.generate(true, "Internal server error.", 500, null)
                }
                res.send(apiResponse)
            } else {
                result = result.toObject()
                delete result._id
                delete result.__v
                delete result.updatedOn
                delete result.userId
                delete result.changeMessage
                let apiResponse = response.generate(false, 'Todo item updated successfully', 200, result)
                res.send(apiResponse)

                //send notification to all users

                notificationController.sendNotification({
                    userId: todo.userId,
                    senderId: req.user.userId,
                    title: "Todo item updated",
                    message: todo.changeMessage,
                    notificationType: 'todo-update-item',
                    targetId: result.todoId,
                    todo: result,
                    eventName: 'todo-notification'

                })
            }

        })

    }

    verifyUserInput()
        .then(verifyToDoItemExists)
        .then(verifyPermission)
        .then(saveItem)
        .catch((apiResponse) => {
            res.send(apiResponse)
        })


}

let markItemCompleted = function (req, res) {


    let verifyUserInput = function () {
        return new Promise((resolve, reject) => {
            if (!req.body.todoId) {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing todo id.', 403, null)
                reject(apiResponse)
            } else if (!req.body.itemId) {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing todo item id.', 403, null)
                reject(apiResponse)
            }
            else {
                resolve()
            }
        })
    }


    let verifyToDoItemExists = function () {
        return new Promise((resolve, reject) => {
            ToDoItemModel.findOne({ todoId: req.body.todoId, id: req.body.itemId })
                .select('-_id -__v -updatedOn')
                .sort('-updatedOn')
                .lean()
                .exec((err, result) => {
                    if (err) {
                        logger.error(err.message, 'Todo Controller: verifyToDoExists', 5)
                        let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                        reject(apiResponse)
                    } else if (result) {
                        if (result.deleted) {
                            let apiResponse = response.generate(true, 'Cannot updated deleted todo item.', 403, null)
                            reject(apiResponse)
                        } else if (result.completed) {
                            let apiResponse = response.generate(true, 'Item is already marked completed.', 403, null)
                            reject(apiResponse)
                        } else resolve(result)
                    } else {
                        let apiResponse = response.generate(true, 'No such todo found.', 404, null)
                        reject(apiResponse)
                    }
                })
        })
    }

    let verifyPermission = function (todo) {
        return new Promise((resolve, reject) => {
            console.log('verify permission')
            if (req.user.userId == todo.userId) resolve(todo)
            FriendModel.findOne({ userId: req.user.userId, friendId: todo.userId }).lean().exec((err, result) => {
                if (err) {
                    logger.error(err.message, 'Todo Controller: verifyPermission', 5)
                    let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                    reject(apiResponse)
                } else if (result) {
                    resolve(todo)
                } else {
                    let apiResponse = response.generate(true, 'You are not friend of the owner of this todo.', 403, null)
                    reject(apiResponse)
                }
            })
        })
    }

    let verifyOpenItems = function (todo) {
        return new Promise((resolve, reject) => {
            console.log('verify open items')
            ToDoItemModel.aggregate([
                {
                    $sort: {
                        updatedOn: 1
                    }
                },
                {
                    $group: {
                        _id: '$id',
                        completed: { $last: '$completed' },
                        deleted: { $last: '$deleted' },
                        todoId: { $last: '$todoId' },
                        parentItemId: { $last: '$parentItemId' },
                    }
                }, {
                    $match: { todoId: req.body.todoId, parentItemId: req.body.itemId, deleted: false, completed: false } // Get those items which are neither completed or deleted
                }
            ]).exec((err, result) => {
                if (err) {
                    logger.error(err.message, 'Todo Controller: verifyOpenItems', 5)
                    let apiResponse = response.generate(true, 'Internal server error.', 500, null)
                    reject(apiResponse)
                }
                else {

                    if (result && result.length > 0) {
                        let apiResponse = response.generate(true, `This todo still has ${result.length} open items. Close or delete all items before closing the todo.`, 403, null)
                        reject(apiResponse)
                    } else resolve(todo)
                }
            })
        })
    }

    let markComplete = function (todo) {

        todo.completed = true
        todo.changeMessage = `${req.user.firstName} marked the todo item ${req.body.itemId} from todo ${req.body.todoId} as complete.`
        let todoItem = new ToDoItemModel(todo)

        todoItem.save((err, result) => {

            if (err) {
                let apiResponse
                logger.error(err.message, 'Todo Controller: saveItem', 5)
                if (err.name = "ValidationError") {
                    apiResponse = response.generate(true, err.message, 403, null)
                } else {
                    apiResponse = response.generate(true, "Internal server error.", 500, null)
                }
                res.send(apiResponse)
            } else {
                result = result.toObject()
                delete result._id
                delete result.__v
                delete result.updatedOn
                delete result.userId
                delete result.changeMessage
                let apiResponse = response.generate(false, 'Todo item updated successfully', 200, result)
                res.send(apiResponse)

                //send notification to all users

                notificationController.sendNotification({
                    userId: todo.userId,
                    senderId: req.user.userId,
                    title: "Todo item updated",
                    message: todo.changeMessage,
                    notificationType: 'todo-update-item',
                    targetId: result.todoId,
                    todo: result,
                    eventName: 'todo-notification'

                })

            }

        })
    }

    verifyUserInput().then(verifyToDoItemExists).then(verifyPermission).then(verifyOpenItems).then(markComplete).catch(apiResponse => { res.send(apiResponse) })
}

let markItemInComplete = function (req, res) {

    let verifyUserInput = function () {
        return new Promise((resolve, reject) => {
            if (!req.body.todoId) {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing todo id.', 403, null)
                reject(apiResponse)
            } else if (!req.body.itemId) {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing todo item id.', 403, null)
                reject(apiResponse)
            }
            else {
                resolve()
            }
        })
    }


    let verifyToDoItemExists = function () {
        return new Promise((resolve, reject) => {
            ToDoItemModel.findOne({ todoId: req.body.todoId, id: req.body.itemId })
                .select('-_id -__v -updatedOn')
                .sort('-updatedOn')
                .lean()
                .exec((err, result) => {
                    if (err) {
                        logger.error(err.message, 'Todo Controller: verifyToDoExists', 5)
                        let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                        reject(apiResponse)
                    } else if (result) {
                        if (result.deleted) {
                            let apiResponse = response.generate(true, 'Cannot updated deleted todo item.', 403, null)
                            reject(apiResponse)
                        } else if (!result.completed) {
                            let apiResponse = response.generate(true, 'Item is already marked incompleted.', 403, null)
                            reject(apiResponse)
                        } else resolve(result)
                    } else {
                        let apiResponse = response.generate(true, 'No such todo item found.', 404, null)
                        reject(apiResponse)
                    }
                })
        })
    }

    let verifyPermission = function (todo) {
        return new Promise((resolve, reject) => {
            console.log('verify permission')
            if (req.user.userId == todo.userId) resolve(todo)
            FriendModel.findOne({ userId: req.user.userId, friendId: todo.userId }).lean().exec((err, result) => {
                if (err) {
                    logger.error(err.message, 'Todo Controller: verifyPermission', 5)
                    let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                    reject(apiResponse)
                } else if (result) {
                    resolve(todo)
                } else {
                    let apiResponse = response.generate(true, 'You are not friend of the owner of this todo.', 403, null)
                    reject(apiResponse)
                }
            })
        })
    }


    let markInComplete = function (todo) {

        todo.completed = false
        todo.changeMessage = `${req.user.firstName} marked the todo item ${req.body.itemId} from todo ${req.body.todoId} as incomplete.`
        let todoItem = new ToDoItemModel(todo)

        todoItem.save((err, result) => {

            if (err) {
                let apiResponse
                logger.error(err.message, 'Todo Controller: saveItem', 5)
                if (err.name = "ValidationError") {
                    apiResponse = response.generate(true, err.message, 403, null)
                } else {
                    apiResponse = response.generate(true, "Internal server error.", 500, null)
                }
                res.send(apiResponse)
            } else {
                result = result.toObject()
                delete result._id
                delete result.__v
                delete result.updatedOn
                delete result.userId
                delete result.changeMessage
                let apiResponse = response.generate(false, 'Todo item updated successfully', 200, result)
                res.send(apiResponse)

                //send notification to all users

                notificationController.sendNotification({
                    userId: todo.userId,
                    senderId: req.user.userId,
                    title: "Todo item updated",
                    message: todo.changeMessage,
                    notificationType: 'todo-update-item',
                    targetId: result.todoId,
                    todo: result,
                    eventName: 'todo-notification'

                })

            }

        })
    }

    verifyUserInput().then(verifyToDoItemExists).then(verifyPermission).then(markInComplete).catch(apiResponse => { res.send(apiResponse) })
}

let renameItem = function (req, res) {

    let verifyUserInput = function () {
        return new Promise((resolve, reject) => {
            if (!req.body.todoId) {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing todo id.', 403, null)
                reject(apiResponse)
            } else if (!req.body.itemId) {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing todo item id.', 403, null)
                reject(apiResponse)
            } else if (!req.body.title || req.body.title.trim() == '') {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing new item title.', 403, null)
                reject(apiResponse)
            }
            else {
                resolve()
            }
        })
    }


    let verifyToDoItemExists = function () {
        return new Promise((resolve, reject) => {
            ToDoItemModel.findOne({ todoId: req.body.todoId, id: req.body.itemId })
                .select('-_id -__v -updatedOn')
                .sort('-updatedOn')
                .lean()
                .exec((err, result) => {
                    if (err) {
                        logger.error(err.message, 'Todo Controller: verifyToDoExists', 5)
                        let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                        reject(apiResponse)
                    } else if (result) {
                        if (result.deleted) {
                            let apiResponse = response.generate(true, 'Cannot updated deleted todo item.', 403, null)
                            reject(apiResponse)
                        } else resolve(result)
                    } else {
                        let apiResponse = response.generate(true, 'No such todo item found.', 404, null)
                        reject(apiResponse)
                    }
                })
        })
    }

    let verifyPermission = function (todo) {
        return new Promise((resolve, reject) => {
            console.log('verify permission')
            if (req.user.userId == todo.userId) resolve(todo)
            FriendModel.findOne({ userId: req.user.userId, friendId: todo.userId }).lean().exec((err, result) => {
                if (err) {
                    logger.error(err.message, 'Todo Controller: verifyPermission', 5)
                    let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                    reject(apiResponse)
                } else if (result) {
                    resolve(todo)
                } else {
                    let apiResponse = response.generate(true, 'You are not friend of the owner of this todo.', 403, null)
                    reject(apiResponse)
                }
            })
        })
    }


    let rename = function (todo) {
        todo.title = req.body.title
        todo.changeMessage = `${req.user.firstName} renamed the todo item ${req.body.itemId} from todo ${req.body.todoId} to ${todo.title}.`
        let todoItem = new ToDoItemModel(todo)

        todoItem.save((err, result) => {

            if (err) {
                let apiResponse
                logger.error(err.message, 'Todo Controller: saveItem', 5)
                if (err.name = "ValidationError") {
                    apiResponse = response.generate(true, err.message, 403, null)
                } else {
                    apiResponse = response.generate(true, "Internal server error.", 500, null)
                }
                res.send(apiResponse)
            } else {
                result = result.toObject()
                delete result._id
                delete result.__v
                delete result.updatedOn
                delete result.userId
                delete result.changeMessage
                let apiResponse = response.generate(false, 'Todo item updated successfully', 200, result)
                res.send(apiResponse)

                //send notification to all users

                notificationController.sendNotification({
                    userId: todo.userId,
                    senderId: req.user.userId,
                    title: "Todo item updated",
                    message: todo.changeMessage,
                    notificationType: 'todo-update-item',
                    targetId: result.todoId,
                    todo: result,
                    eventName: 'todo-notification'

                })

            }

        })
    }

    verifyUserInput().then(verifyToDoItemExists).then(verifyPermission).then(rename).catch(apiResponse => { res.send(apiResponse) })
}

let undo = function (req, res) {

    let verifyUserInput = function () {
        return new Promise((resolve, reject) => {
            if (!req.body.todoId) {
                let apiResponse = response.generate(true, 'Invalid input to api. Missing todo id.', 403, null)
                reject(apiResponse)
            }
            else {
                resolve()
            }
        })
    }

    //verify todo item and get the last updated item
    let verifyToDoItemExists = function () {
        console.log('verify todo exist')
        return new Promise((resolve, reject) => {
            ToDoItemModel.findOne({ todoId: req.body.todoId }) // get the top item
                .select('id userId')
                .sort('-updatedOn')
                .lean()
                .exec((err, result) => {
                    console.log(result)
                    if (err) {
                        logger.error(err.message, 'Todo Controller: verifyToDoExists', 5)
                        let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                        reject(apiResponse)
                    } else if (result) {
                        resolve(result)
                    } else {
                        let apiResponse = response.generate(true, 'There are no previous actions for this todo.', 404, null)
                        reject(apiResponse)
                    }
                })
        })
    }



    let verifyPermission = function (todo) {
        console.log('verify permission')

        return new Promise((resolve, reject) => {
            if (req.user.userId == todo.userId) resolve(todo)
            FriendModel.findOne({ userId: req.user.userId, friendId: todo.userId }).lean().exec((err, result) => {
                if (err) {
                    logger.error(err.message, 'Todo Controller: verifyPermission', 5)
                    let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                    reject(apiResponse)
                } else if (result) {
                    console.log(todo)
                    resolve(todo)
                } else {
                    let apiResponse = response.generate(true, 'You are not friend of the owner of this todo.', 403, null)
                    reject(apiResponse)
                }
            })
        })
    }

    let getTwoLatestVersions = function (todo) {
        console.log('get latest version')
        console.log(todo)
        return new Promise((resolve, reject) => {
            ToDoItemModel.find({ id: todo.id }) // get the top 2 items, the first will be removed and the second will be returned to user.
                .limit(2)
                .select('-__v -updatedOn')
                .sort('-updatedOn')
                .lean()
                .exec((err, result) => {
                    if (err) {
                        logger.error(err.message, 'Todo Controller: verifyToDoExists', 5)
                        let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                        reject(apiResponse)
                    } else if (result && result.length > 0) {
                        resolve(result)
                    } else {
                        let apiResponse = response.generate(true, 'There are no previous actions for this todo.', 404, null)
                        reject(apiResponse)
                    }
                })
        })


    }


    let removeTopItem = function (todo) {

        ToDoItemModel.deleteOne({ _id: todo[0]._id }).exec((err, result) => {

            if (err) {
                let apiResponse
                logger.error(err.message, 'Todo Controller: removeTopItem', 5)
                if (err.name = "ValidationError") {
                    apiResponse = response.generate(true, err.message, 403, null)
                } else {
                    apiResponse = response.generate(true, "Internal server error.", 500, null)
                }
                res.send(apiResponse)
            } else {
                let oldVersion
                let message = `${req.user.firstName} undo the following change to todo item ${todo[0].id} from todo ${req.body.todoId}: ${todo[0].changeMessage}`


                if (todo.length == 2) oldVersion = todo[1] // 
                else {
                    oldVersion = todo[0]
                    oldVersion.deleted = true // this is done so that the front end does not show this todo as there are no previous version of this todoItem to update to
                }

                delete oldVersion._id
                delete oldVersion.changeMessage
                let apiResponse = response.generate(false, 'Todo item updated successfully', 200, oldVersion)
                res.send(apiResponse)

                //send notification to all users

                notificationController.sendNotification({
                    userId: oldVersion.userId,
                    senderId: req.user.userId,
                    title: "Todo item change undo",
                    message: message,
                    notificationType: 'todo-update-item',
                    targetId: oldVersion.todoId,
                    todo: oldVersion,
                    eventName: 'todo-notification'

                })

            }

        })
    }

    verifyUserInput().then(verifyToDoItemExists).then(verifyPermission).then(getTwoLatestVersions).then(removeTopItem).catch(apiResponse => { res.send(apiResponse) })
}


module.exports = {

    createToDo: createToDo,
    listToDo: listToDo,
    createToDoItem: createToDoItem,
    listTodoItem: listTodoItem,
    markTodoComplete: markTodoComplete,
    markTodoInComplete: markTodoInComplete,
    markItemDeleted: markItemDeleted,
    markItemCompleted: markItemCompleted,
    markItemIncomplete: markItemInComplete,
    renameItem: renameItem,
    undo: undo
}