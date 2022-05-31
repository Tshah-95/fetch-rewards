exports.buildResponse = (code, data, message) => {
    return {
        statusCode: code,
        body: JSON.stringify({
            data,
            message
        })
    }
}