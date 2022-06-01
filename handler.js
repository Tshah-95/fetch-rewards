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
        const parsedEvent = JSON.parse(event.body)

        // check for all necessary parameters of a transaction
        if (!(parsedEvent?.partner && parsedEvent?.points && parsedEvent?.time)) {
            return buildResponse(422, parsedEvent, "Improper Body Parameters Provided")
        }

        // destructure properties since they are confirmed as defined
        const { partner, points, time: rawTime } = parsedEvent

        // if transaction with pre-existing partner and time comes through, there will be unintended functionality

        // check for time being invalid (poorly formatted or in future)
        // assumption made that if Date cannot parse the timestamp it is in an invalid format
        // timezone assumed to be UTC if not provided (would need added logic or library to take to production)
        const time = new Date(rawTime).toISOString()
        const transactionToInsert = { partner, points, time }

        // getTime returns the unix epoch in ms
        const transTime = new Date(rawTime).getTime()
        const currTime = new Date().getTime()
        if (transTime > currTime) return buildResponse(422, transactionToInsert, "Cannot create transaction for future time")


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
            if (partnerPointTotal + points < 0) return buildResponse(422, transactionToInsert, "Action results in negative balance")

            await db.put({ TableName: Transactions, Item: transactionToInsert }).promise()

            return buildResponse(200, transactionToInsert, "Transaction successfully posted!")
        }
    } catch (e) {
        return buildResponse(500, event, e.message)
    }
}

exports.spendPoints = async (event) => {
    try {
        const parsedEvent = JSON.parse(event.pathParameters)

        // check for points path parameter
        if (!(parsedEvent?.points) || parsedEvent.points <= 0) {
            return buildResponse(422, parsedEvent, "Improper path parameters provided")
        }

        // this value will be decremented until it reaches 0 or is found to be too large
        let pointsToSpendRemaining = parsedEvent.points

        // map for amounts subtracted per partner
        const spendingMap = new Map()

        const [ allTransactions, balanceMap ] = await getTransactionsAndBalances()

        for (let transaction of allTransactions) {
            const { partner, points } = transaction
            const activePoints = balanceMap.get(partner)
            // if another transaction by this partner has been used to pay,
            // account for that when processing other transactions by that partner
            if (spendingMap.has(partner)) activePoints -= spendingMap.get(partner)

            if (points <= 0 || activePoints <= 0) continue

            let maxUsablePoints = Math.min(activePoints, points)

            let pointsUsed = Math.min(pointsToSpendRemaining, maxUsablePoints)

            if (pointsUsed > 0) {
                // if map already contains partner, combine values to result in total by-partner
                // else simply insert current points used as baseline
                if (spendingMap.has(partner)) {
                    let oldVal = spendingMap.get(partner)
                    spendingMap.set(partner, oldVal + pointsUsed)
                } else spendingMap.set(partner, pointsUsed)

                pointsToSpendRemaining -= pointsUsed
            }

            if (pointsToSpendRemaining === 0) break
        }

        if (pointsToSpendRemaining > 0) return buildResponse(422, parsedEvent, "Points provided too large")

        //create array from map, invert points to show as negatives in response
        const spendingArray = Array.from(spendingMap, ([ partner, points ]) => ({ partner, points: -points }));

        return buildResponse(200, spendingArray, "Points successfuly spent!")
    } catch (e) {
        return buildResponse(500, event, e.message)
    }
}

// This endpoint simply returns the sums of each transaction by-partner, aka their active balance
exports.getBalances = async (event) => {
    try {
        const [ , balanceMap ] = await getTransactionsAndBalances()

        return buildResponse(200, Object.fromEntries(balanceMap), "Successfully retreived active balances!")
    } catch (e) {
        return buildResponse(500, event, e.message)
    }
}

// Retreive all transactions in the db, sort them by time ascending
// and return the sorted array along side the map of active points per payer
const getTransactionsAndBalances = async () => {
    const transactionsRes = await db.scan({ TableName: Transactions }).promise()
    let allTransactions = transactionsRes.Items
    // sort by timestamp ascending
    allTransactions.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

    const balanceMap = new Map()

    for (const transaction of allTransactions) {
        const { partner, points } = transaction

        // if map already contains partner, combine values to result in total by-partner
        // else simply insert current transaction as baseline
        if (balanceMap.has(partner)) {
            let oldVal = balanceMap.get(partner)
            balanceMap.set(partner, oldVal + points)
        } else balanceMap.set(partner, points)
    }

    return [ allTransactions, balanceMap ]
}
