const mongoose = require('mongoose')
const logger = require('./../libs/loggerLib')
const response = require('./../libs/responseLib')
const shortId = require('short-id')
const eventEmitter = require('./../libs/eventLib').eventEmitter
const config = require('./../../config/appConfig')
const notificationController = require('./notificationController')



const RequestModel = mongoose.model('Request')
const UserModel = mongoose.model('User')
const FriendModel = mongoose.model('Friend')

let sendRequest = function (req, res) {

    let verifyUserExists = function () {

        return new Promise((resolve, reject) => {

            if (req.user.email == req.body.email) reject(response.generate(true, "Cannot send request to self.", 403, null))
            UserModel.findOne({ email: req.body.email }).lean().exec((err, result) => {

                if (err) {
                    logger.error(err.message, 'Friend Controller: verifyUserExists', 5)
                    let apiResponse = response.generate(true, 'Internal server error', 500, null)
                    reject(apiResponse)
                } else if (result) {
                    req.receiver = result._id
                    req.body.userId = result.userId
                    resolve()
                } else {
                    let apiResponse = response.generate(true, 'No such user exists on the platform.', 404, null);
                    reject(apiResponse);
                }
            })
        })
    }

    let verifyRequestNotAlreadySent = function () {

        return new Promise((resolve, reject) => {
            RequestModel.findOne().or([{ senderId: req.user.userId, receiverId: req.body.userId }, { senderId: req.body.userId, receiverId: req.user.userId }]).lean().exec((err, result) => {

                if (err) {
                    logger.error(err.message, 'Friend Controller: verifyRequestNotAlreadySent', 5)
                    let apiResponse = response.generate(true, 'Internal server error', 500, null)
                    reject(apiResponse)
                } else if (result) {
                    let apiResponse
                    if (result.status == 0) apiResponse = response.generate(true, 'Request already sent or received.', 403, null)
                    else if (result.status == 1) apiResponse = response.generate(true, 'Already a friend.', 403, null)
                    else apiResponse = response.generate(true, 'Internal server error', 500, null)
                    reject(apiResponse)
                } else {
                    resolve()
                }

            })
        })

    }// Verify that the user has not already sent request or received request from the target user. This is to avoid duplicate pairs


    let verifyNotAlreadyFriend = function () {
        return new Promise((resolve, reject) => {

            FriendModel.findOne({ userId: req.user.userId, friendId: req.body.userId }).lean().exec((err, result) => {
                if (err) {
                    logger.error(err.message, 'Friend Controller: verifyUserExists', 5)
                    let apiResponse = response.generate(true, 'Internal server error', 500, null)
                    reject(apiResponse)
                } else {

                    if (result) {

                        let apiResponse = response.generate(true, 'Already a friend', 403, null)
                        reject(apiResponse)

                    } else {

                        let request = new RequestModel({
                            senderId: req.user.userId,
                            receiverId: req.body.userId,
                            sender: req.user._id,
                            receiver: req.receiver
                        })

                        resolve(request)
                    }
                }
            })
        })
    }

    let saveRequest = function (request) {

        return new Promise((resolve, reject) => {
            request.save((err, result) => {
                if (err) {
                    let apiResponse
                    if (err.name = "ValidationError") {
                        apiResponse = response.generate(true, err.message, 403, null)
                    } else {
                        apiResponse = response.generate(true, "Internal server error.", 500, null)
                    }
                    reject(apiResponse)
                } else {
                    resolve(result)
                }
            })
        })

    }


    verifyUserExists()
        .then(verifyRequestNotAlreadySent)
        .then(verifyNotAlreadyFriend)
        .then(saveRequest)
        .then((result) => {

            let notificationObj = {
                type: 'friend-request',
                userId: result.receiverId,
                targetId: result.senderId, // todo id or friend id based on the type.
                message: `You have received a new friend request from ${req.user.firstName}.`,
                title: "New Request",
                read: false
            }

            notificationController.saveNotification([notificationObj])

            eventEmitter.emit("friend-notification", notificationObj)

            let apiResponse = response.generate(false, "Request sent", 200, null)
            res.send(apiResponse)
        })
        .catch((err) => {
            res.send(err)
        })

}

let listFriendRequests = function (req, res) {


    if (!req.body.page || req.body.page == 0 || req.body.page < 0) req.body.page = 0
    else req.body.page -= 1

    /*Page index for api starts from 1 and page less than 0, equal to 0 and 1 will all return first page*/

    if (!req.body.timestamp) req.body.timestamp = Date.now()


    RequestModel.find({ receiverId: req.user.userId, status: 0 })
        .where('sentOn').lte(req.body.timestamp)
        .sort("-sentOn")
        .skip((req.body.page) * config.pageSize)
        .limit(config.pageSize)
        .lean()
        .select('-_id sender')
        .populate('sender', '-_id firstName lastName userId')
        .exec((err, result) => {

            if (err) {
                logger.error(err.message, 'Friend Controller: listFriendRequests', 5)
                let apiResponse = response.generate(true, 'Internal server error', 500, null)
                res.send(apiResponse)
            } if (result && result.length == 0) {
                let apiResponse = response.generate(false, 'No more friend requests here.', 200, result)
                res.send(apiResponse)
            } else {
                let apiResponse = response.generate(false, 'success', 200, result)
                res.send(apiResponse)
            }
        })

}


let getRequestCount = function (req, res) {
    RequestModel.countDocuments({ receiverId: req.user.userId, status: 0 })
        .exec((err, result) => {
            if (err) {
                let apiResponse = response.generate(true, 'Internal server error', 500, null)
                res.send(apiResponse)
            }
            else {
                let apiResponse = response.generate(false, 'Pending Friend Request Count', 200, result)
                res.send(apiResponse)
            }
        })
}

let acceptRequest = function (req, res) {

    let verifyNotAlreadyFriend = function () {
        return new Promise((resolve, reject) => {

            FriendModel.findOne({ userId: req.user.userId, friendId: req.body.userId }).lean().exec((err, result) => {
                if (err) {
                    logger.error(err.message, 'Friend Controller: verifyUserExists', 5)
                    let apiResponse = response.generate(true, 'Internal server error', 500, null)
                    reject(apiResponse)
                } else {

                    if (result) {

                        let apiResponse = response.generate(true, 'Already a friend', 403, null)
                        reject(apiResponse)

                    } else {
                        resolve()
                    }
                }
            })
        })
    }


    let getRequest = function () {

        return new Promise((resolve, reject) => {

            if (!req.body.userId) reject(response.generate(true, 'No user selected to accept request from.', 403, null))

            RequestModel.findOne({ receiverId: req.user.userId, senderId: req.body.userId })
                .select("sender receiver")
                .lean()
                .exec((err, result) => {
                    if (err) {
                        logger.error(err.message, 'Friend Controller: acceptRequest', 5)
                        let apiResponse = response.generate(true, 'Internal server error', 500, null)
                        reject(apiResponse)
                    } else if (result) {
                        resolve(result)
                    } else {
                        let apiResponse = response.generate(true, 'You did not receive a request from this user.', 403, null)
                        reject(apiResponse)
                    }
                })
        })
    }

    let updateFriendList = function (reqObj) {

        return FriendModel.insertMany([{ userId: req.body.userId, friendId: req.user.userId, user: reqObj.sender, friend: reqObj.receiver },
        { friendId: req.body.userId, userId: req.user.userId, friend: reqObj.sender, user: reqObj.receiver }])

    }

    let updateRequest = function (resultArray) {
        return new Promise((resolve, reject) => {

            RequestModel.updateOne({ senderId: req.body.userId, receiverId: req.user.userId }, { status: 1 }).exec((err, result) => {
                if (err) {
                    logger.error(err.message, 'Friend Controller: updateRequest', 5)
                }
                resolve()
            })
        })
    }

    verifyNotAlreadyFriend()
        .then(getRequest)
        .then(updateFriendList)  // add notification code after this and before the next then
        .then(updateRequest)
        .then(() => {

            let notificationObj = {
                type: 'friend-add',
                userId: req.body.userId,
                targetId: req.user.userId, // todo id or friend id based on the type.
                message: `${req.user.firstName} accepted your friend request.`,
                title: "New Friend",
                read: false
            }

            notificationController.saveNotification([notificationObj])

            eventEmitter.emit("friend-notification", {
                userId: req.body.userId, // user id to send the message to
                friendId: req.user.userId,
                type: 'friend-add',
                message: `${req.user.firstName} accepted your friend request.`,
                title: "New Friend"
            })


            let apiResponse = response.generate(false, "Friend added.", 200, null)
            res.send(apiResponse)

        })
        .catch((err) => {
            res.send(err)
        })


}

let listFriends = function (req, res) {

    if (!req.body.page || req.body.page == 0 || req.body.page < 0) req.body.page = 0
    else req.body.page -= 1

    if (!req.body.timestamp) req.body.timestamp = Date.now()


    FriendModel.find({ userId: req.user.userId })
        .select('-_id friend friendId')
        .where('addedOn').lte(req.body.timestamp)
        .sort("-addedOn")
        .skip((req.body.page) * config.pageSize)
        .limit(config.pageSize)
        .populate('friend', '-_id firstName lastName')
        .lean()
        .exec((err, result) => {

            if (err) {
                logger.error(err.message, 'Friend Controller: listFriends', 5)
                let apiResponse = response.generate(true, 'Internal server error', 500, null)
                res.send(apiResponse)
            } else {
                let apiResponse = response.generate(false, 'List of friends', 200, result)
                res.send(apiResponse)
            }

        })

}




module.exports = {
    sendRequest: sendRequest,
    listFriendRequests: listFriendRequests,
    acceptRequest: acceptRequest,
    listFriends: listFriends,
    getRequestCount: getRequestCount
}