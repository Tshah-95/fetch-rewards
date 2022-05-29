# fetch-rewards
Coding Exercise for Fetch Rewards Backend Software Engineering Role

This web service was built in Node.js and will be hosted in AWS with Serverless Framework for IAC and Deployment.

In order to run the web service, you will have to first configure node on your local machine, configure the AWS CLI and provide it your access keys, and finally configure serverless framework

Guides for each of these processes can be found here:
1.) Download & Install Node -> https://nodejs.org/en/download/package-manager/
2.) AWS CLI Setup -> https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
3.) AWS CLI Access Key Setup -> https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html
4.) Download & Install Serverless Framework Globally -> simply enter the following into your command line: npm install serverless -g

In order to deploy the API, simply clone this repository, cd to the base directory, and execute "serverless deploy".
The console should output important resources alongside endpoint documentation for the API. This should be enough to send requests to that API via Postman.
