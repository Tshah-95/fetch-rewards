'use strict'
const { DynamoDB } = require("aws-sdk")
const { buildResponse } = require("./response")

const db = new DynamoDB.DocumentClient()
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
            return buildResponse(422, parsedTransaction, "Improper Body Parameters Provided")
        }

        // destructure properties since they are confirmed as defined
        const { partner, points, time: rawTime } = parsedTransaction

        // if transaction with pre-existing partner and time comes through, there will be unintended functionality

        // check for time being invalid (poorly formatted or in future)
        // assumption made that if Date cannot parse the timestamp it is in an invalid format
        // should account for timezone OOB since ISO strings contain timezone data
        const time = new Date(rawTime).toISOString()

        // getTime returns the unix epoch in ms
        const transTime = new Date(rawTime).getTime()
        const currTime = new Date().getTime()
        if (transTime > currTime) return buildResponse(422, parsedTransaction, "Cannot create transaction for future time")

        const transactionToInsert = { partner, points, time }

        if (points > 0) {
            await db.put({ TableName: Transactions, Item: transactionToInsert }).promise()
            return buildResponse(200, transactionToInsert, "Transaction successfully posted!")
        } else {
            // retreive all transactions for the current partner
            const partnerTransactions = await db.query({
                TableName: Transactions,
                KeyConditionExpression: "partner = :p",
                ExpressionAttributeValues: { ":p": partner }
            }).promise()

            // create an accumulator that starts at 0 and adds the points of each transaction.
            // this effectively returns the active balance for a given partner
            let partnerPointTotal = partnerTransactions.Items.reduce(
                (prevVal, currItem) => prevVal + currItem.points, 0
            )

            // if the point total is more negative than the balance of the partner, prevent the action
            if (partnerPointTotal + points < 0) return buildResponse(422, parsedTransaction, "Action results in negative balance")

            await db.put({ TableName: Transactions, Item: transactionToInsert }).promise()

            return buildResponse(200, transactionToInsert, "Transaction successfully posted!")
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

// This endpoint simply returns the sums of each transaction by-partner, aka their active balance
exports.getBalances = async (event) => {
    try {
        const allTransactions = await db.scan({ TableName: Transactions }).promise()

        const balanceMap = new Map()

        for (const transaction of allTransactions.Items) {
            const { partner, points } = transaction

            // if map already contains partner, combine values to result in total by-partner
            // else simply insert current transaction as baseline
            if (balanceMap.has(partner)) {
                let oldVal = balanceMap.get(partner)
                balanceMap.set(partner, oldVal + points)
            } else balanceMap.set(partner, points)
        }

        return buildResponse(200, Object.fromEntries(balanceMap), "Successfully Retreived Active Balances!")
    } catch (e) {
        return buildResponse(500, event, e.message)
    }
}
