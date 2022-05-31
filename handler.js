'use strict'
const { DynamoDB } = require("aws-sdk")
const { buildResponse } = require("./response")

const db = new DynamoDB()
const Transactions = process.env.TRANSACTIONS_TABLE_NAME

exports.createTransaction = async (event) => {
    try {
        const result = await db.scan({ TableName: Transactions }).promise()
        return buildResponse(200, result, "Result returns current transactions")
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
        return buildResponse(200, result, "Result returns current transactions")
    } catch (e) {
        return buildResponse(500, event, e.message)
    }
}
