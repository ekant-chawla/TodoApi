const EventEmitter = require('events').EventEmitter

const mailer = require('./mailLib')

//event emitter object that is used thoughout the app to trigger common events
const eventEmitter = new EventEmitter()

eventEmitter.on('sendEmail', mailer.sendEmail)
eventEmitter.on('signupEmail', mailer.signUpEmail)
eventEmitter.on('forgotPassEmail', mailer.forgotPassEmail)


module.exports = {
    eventEmitter: eventEmitter
}










