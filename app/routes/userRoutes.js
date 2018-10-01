const express = require('express')
const userController = require('./../controllers/userController');
const config = require('./../../config/appConfig')
const routeMiddleware = require('./../middlewares/routeMiddleware');
const friendController = require('./../controllers/friendController')
const notificationController = require('./../controllers/notificationController')


let setRoutes = function (app) {
    let baseUrl = config.version + "/user"

    app.post(baseUrl + '/signup', userController.signup)
    app.post(baseUrl + '/login', userController.login)
    app.post(baseUrl + '/updatePass', routeMiddleware.verifyPassResetToken, userController.updatePassword)
    app.post(baseUrl + '/forgotPass', userController.forgotPassword)    
    app.post(baseUrl + '/friend/sendRequest', routeMiddleware.verifyAuthToken, friendController.sendRequest)
    app.post(baseUrl + '/friend/listFriendRequests', routeMiddleware.verifyAuthToken, friendController.listFriendRequests)
    app.post(baseUrl + '/friend/acceptRequest', routeMiddleware.verifyAuthToken, friendController.acceptRequest)
    app.post(baseUrl + '/friend/listFriends', routeMiddleware.verifyAuthToken, friendController.listFriends)
    app.post(baseUrl + '/friend/getRequestCount', routeMiddleware.verifyAuthToken, friendController.getRequestCount)
    app.post(baseUrl + '/notification/list', routeMiddleware.verifyAuthToken, notificationController.listNotification)
    app.post(baseUrl + '/notification/getCount', routeMiddleware.verifyAuthToken, notificationController.getNotificationCount)

}


module.exports = {
    setRoutes: setRoutes
}
