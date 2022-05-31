'use strict'
const { DynamoDB } = require("aws-sdk")
const { buildResponse } = require("./response")

const db = new DynamoDB()
const Transactions = process.env.TRANSACTIONS_TABLE_NAME

// This endpoint creates a transaction that is processed by the backend under the following conditions:
// 1.) The request is in a valid format
// 2.) The request includes a partner, points, and valid time
// 3.) The provided points for the given partner would not reduce their points to be below 0
// If the request does not meet those criteria it will return an appropriate non-200 response 
exports.createTransaction = async (event) => {
    try {
        const parsedTransaction = JSON.parse(event.body)

        // check for all necessary parameters of a transaction
        if (!(parsedTransaction?.partner && parsedTransaction?.points && parsedTransaction?.time)) {
            return buildResponse(422, event, "Improper Body Parameters Provided")
        }

        // destructure properties since they are confirmed as defined
        const { partner, points, time } = parsedTransaction

        // need to add check for time being invalid (poorly formatted or in future)

        if (points > 0) {
            db.putItem({ TableName: Transactions, Item: { partner, points, time } })
            return buildResponse(200, { partner, points, time }, "Transaction successfully posted!")
        } else {
            // retreive all transactions for the current partner
            const partnerTransactions = await db.query({
                TableName: Transactions,
                ExpressionAttributeValues: {
                    ":p": { S: partner }
                },
                KeyConditionExpression: "partner = :p",
                ProjectionExpression: 'partner, points, time'
            }).promise()

            // create an accumulator that starts at 0 and adds the points of each transaction.
            // this effectively returns the current point count for a given partner
            let partnerPointTotal = partnerTransactions.Items.reduce(
                (prevVal, currItem) => prevVal + currItem.points, 0
            )

            // if the point total is more negative than the balance of the partner, prevent the action
            if (partnerPointTotal + points < 0) return buildResponse(422, event, "Action results in negative balance")

            db.putItem({ TableName: Transactions, Item: { partner, points, time } })

            return buildResponse(200, { partner, points, time }, "Transaction successfully posted!")
        }
    } catch (e) {
        return buildResponse(500, event, e.message)
    }
}

exports.spendPoints = async (event) => {
    try {
        const result = await db.scan({ TableName: Transactions }).promise()
        return buildResponse(200, result, "Result returns current transactions")
    } catch (e) {
        return buildResponse(500, event, e.message)
    }
}

exports.getBalances = async (event) => {
    try {
        const result = await db.scan({ TableName: Transactions }).promise()
        return buildResponse(200, result.Items, "Result returns current transactions")
    } catch (e) {
        return buildResponse(500, event, e.message)
    }
}
