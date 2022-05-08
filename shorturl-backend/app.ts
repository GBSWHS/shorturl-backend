import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { CloudFrontResponse, CloudFrontResponseHandler } from 'aws-lambda';

const HOME_PAGE_URL = 'http://school.gyo6.net/gbsw';
const DB_TABLE_NAME = 'urlshorter-db';
const DB_REGION_NAME = 'ap-northeast-2';

const dynamoClient = new DynamoDBClient({ region: DB_REGION_NAME });

const redirect = (url: string): CloudFrontResponse => ({
    status: '302',
    statusDescription: 'Found',
    headers: {
        location: [
            {
                key: 'Location',
                value: url,
            },
        ],
    },
});

const getLongURL = async (shortPath: string): Promise<string | undefined> => {
    const command = new GetItemCommand({
        TableName: DB_TABLE_NAME,
        Key: {
            short_path: {
                S: shortPath,
            },
        },
    });

    try {
        const data = await dynamoClient.send(command);
        return data.Item?.long_url.S;
    } catch (e) {
        console.error(e);
        return undefined;
    }
};

const lambdaFunction: CloudFrontResponseHandler = async (event) => {
    const requestURI = event.Records[0].cf.request.uri;
    if (requestURI === '/') {
        return redirect(HOME_PAGE_URL);
    }

    const longURL = await getLongURL(requestURI);
    if (!longURL) {
        return redirect(HOME_PAGE_URL);
    }

    return redirect(longURL);
};

export { lambdaFunction };
