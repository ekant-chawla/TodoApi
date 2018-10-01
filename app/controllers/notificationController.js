const mongoose = require('mongoose')
const logger = require('./../libs/loggerLib')
const response = require('./../libs/responseLib')
const shortId = require('short-id')
const config = require('./../../config/appConfig')
const eventEmitter = require('./../libs/eventLib').eventEmitter

const NotificationModel = mongoose.model("Notification")
const FriendModel = mongoose.model('Friend')

let listNotifications = function (req, res) {

    if (!req.body.page || req.body.page == 0 || req.body.page < 0) req.body.page = 0
    else req.body.page -= 1

    NotificationModel.find({ userId: req.user.userId })
        .lean()
        .sort("-sentOn")
        .select("-_id -__v -sentOn")
        .skip(req.body.page * config.pageSize)
        .limit(config.pageSize)
        .exec((err, result) => {
            if (err) {
                logger.error(err.message, 'Notification Controller: listNotification', 5)
                let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                res.send(apiResponse)
            } else {
                let apiResponse = response.generate(false, 'Listing Notifications', 200, result)
                res.send(apiResponse)
            }
            //update all notifications to read when you query for notification list
            NotificationModel.updateMany({ userId: req.user.userId, read: false }, { read: true }).exec((err, result)=>{

            })


        })
}

let getNotificationCount = function (req, res) {
    NotificationModel.countDocuments({ userId: req.user.userId, read: false })
        .exec((err, result) => {
            if (err) {
                logger.error(err.message, 'Notification Controller: count', 5)
                let apiResponse = response.generate(true, 'Internarl server error', 500, null)
                res.send(apiResponse)
            } else {
                let apiResponse = response.generate(false, 'Listing Notification Count', 200, result)
                res.send(apiResponse)
            }

        })
}

let saveNotification = function (notificationArray) {

    NotificationModel.insertMany(notificationArray, (err, result) => {

        if (err) {
            logger.error(err.message, 'Notification Controller: saveNotification', 5)
        } else {
        }
    })

}

let sendNotification = function (obj) {
    FriendModel.find({ userId: obj.userId, friendId: { $ne: obj.senderId } }).select("-_id friendId").lean().exec((err, result) => {
        if (err) {
            logger.error(err.message, 'Todo Controller: sending notifications', 5)
        } else {

            if (obj.senderId != obj.userId) result.push({ friendId: obj.userId }) // if the notification creator is not the owner of todo then add the owner to list of notified users

            let notifications = result.map((friend) => {
                return {
                    type: obj.notificationType,
                    targetId: obj.targetId, // todo id or friend id based on the type.
                    message: obj.message,
                    title: obj.title,
                    read: false,
                    userId: friend.friendId
                }
            })


            saveNotification(notifications)

        }
    })

    //event to notify socket
    eventEmitter.emit(obj.eventName, {
        type: obj.notificationType,
        userId: obj.senderId, //the person who made the change
        roomId: obj.userId, // room id where to send the message
        message: obj.message,
        title: obj.title,
        todo: obj.todo // the new todo created. To update in real time.
    })



}



module.exports = {
    listNotification: listNotifications,
    saveNotification: saveNotification,
    sendNotification: sendNotification,
    getNotificationCount:getNotificationCount
}