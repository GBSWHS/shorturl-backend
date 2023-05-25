import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { CloudFrontResponse, CloudFrontResponseHandler } from 'aws-lambda';

const IP_ALLOWLIST = process.env.IP_ALLOWLIST;
const HOME_PAGE_URL = 'http://school.gyo6.net/gbsw';
const DB_TABLE_NAME = 'urlshorter-db';
const DB_REGION_NAME = 'ap-northeast-2';

const dynamoClient = new DynamoDBClient({ region: DB_REGION_NAME });

const sendCreated = (): CloudFrontResponse => ({
    status: '201',
    statusDescription: 'Created',
    headers: {},
});

const redirect = (url: string): CloudFrontResponse => ({
    status: '302',
    statusDescription: 'Found',
    headers: {
        location: [
            {
                key: 'Location',
                value: url,
            },
            {
                key: 'Access-Control-Allow-Origin',
                value: '*'
            }
        ],
    },
});

const sendConflictError = (): CloudFrontResponse => ({
    status: '409',
    statusDescription: 'Conflict',
    headers: {},
});

const sendUnauthorizedError = (): CloudFrontResponse => ({
    status: '401',
    statusDescription: 'Unauthorized',
    headers: {},
});

const sendBadRequestError = (): CloudFrontResponse => ({
    status: '400',
    statusDescription: 'Bad Request',
    headers: {},
});

const sendServerError = (): CloudFrontResponse => ({
    status: '500',
    statusDescription: 'Service Unavailable',
    headers: {},
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

const putRecord = async (shortPath: string, longURL: string) => {
    const command = new PutItemCommand({
        TableName: DB_TABLE_NAME,
        Item: {
            short_path: {
                S: shortPath,
            },
            long_url: {
                S: longURL,
            },
        },
    });

    try {
        await dynamoClient.send(command);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

const lambdaFunction: CloudFrontResponseHandler = async (event) => {
    const requestURI = event.Records[0].cf.request.uri;
    if (requestURI === '/') {
        return redirect(HOME_PAGE_URL);
    }

    if (requestURI === '/api/regist') {
        const q = new URLSearchParams(event.Records[0].cf.request.querystring);

        if (event.Records[0].cf.request.clientIp !== IP_ALLOWLIST) {
            return sendUnauthorizedError();
        }

        const s = q.get('s');
        const l = q.get('l');

        if (!s || !l) return sendBadRequestError();
        if (s.length < 4 || s.length > 20) return sendBadRequestError();
        if (l.length < 4 || l.length > 255) return sendBadRequestError();

        if (await getLongURL(q.get('s') || '')) {
            return sendConflictError();
        }

        const success = putRecord(s, l);

        if (!success) return sendServerError();
        return sendCreated();
    }

    const longURL = await getLongURL(requestURI);
    if (!longURL) {
        return redirect(HOME_PAGE_URL);
    }

    return redirect(longURL);
};

export { lambdaFunction };
