
const express = require('express')
const todoController = require('./../controllers/todoController');
const config = require('./../../config/appConfig')
const routeMiddleware = require('./../middlewares/routeMiddleware');


let setRoutes = function (app) {
    let baseUrl = config.version + "/todo"

    app.post(baseUrl + '/create', routeMiddleware.verifyAuthToken, todoController.createToDo);
    app.post(baseUrl + '/list', routeMiddleware.verifyAuthToken, todoController.listToDo);
    app.post(baseUrl + '/createToDoItem', routeMiddleware.verifyAuthToken, todoController.createToDoItem);
    app.post(baseUrl + '/listToDoItem', routeMiddleware.verifyAuthToken, todoController.listTodoItem);
    app.post(baseUrl + '/closeTodo', routeMiddleware.verifyAuthToken, todoController.markTodoComplete);
    app.post(baseUrl + '/openTodo', routeMiddleware.verifyAuthToken, todoController.markTodoInComplete);
    app.post(baseUrl + '/markItemDeleted', routeMiddleware.verifyAuthToken, todoController.markItemDeleted);
    app.post(baseUrl + '/closeItem', routeMiddleware.verifyAuthToken, todoController.markItemCompleted);
    app.post(baseUrl + '/openItem', routeMiddleware.verifyAuthToken, todoController.markItemIncomplete);
    app.post(baseUrl + '/undo', routeMiddleware.verifyAuthToken, todoController.undo);
    app.post(baseUrl + '/renameItem', routeMiddleware.verifyAuthToken, todoController.renameItem);




}


module.exports = {
    setRoutes: setRoutes
}
