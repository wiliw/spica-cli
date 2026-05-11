import axios from 'axios';
export class WebFetchCapability {
    name = 'web_fetch';
    description = 'Fetch data from a URL with support for various HTTP methods';
    async execute(params) {
        try {
            const config = {
                method: params.method || 'GET',
                url: params.url,
                headers: params.headers,
                data: params.body,
                timeout: params.timeout || 30000,
                validateStatus: () => true,
            };
            const response = await axios(config);
            const headers = {};
            Object.entries(response.headers).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    headers[key] = value;
                }
            });
            return {
                success: response.status >= 200 && response.status < 300,
                data: {
                    status: response.status,
                    statusText: response.statusText,
                    headers,
                    data: response.data,
                    url: response.config.url || params.url,
                },
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                metadata: {
                    url: params.url,
                    method: params.method || 'GET',
                },
            };
        }
    }
}
//# sourceMappingURL=WebFetch.js.map