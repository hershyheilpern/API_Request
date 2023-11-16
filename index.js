const axios = require('axios');
const querystring = require('node:querystring');
function ALL(config) {
    return new Promise((resolve, reject) => {
        let httpconfig = {
            method: config.method,
            url: `${config.base_url}${config.v || config.default_v}${config.path}${config.query ? `?${querystring.stringify(config.query)}` : ''}}`,
            headers: { 'Authorization': `${config.auth_prefix || "Bearer"} ${config.key}`, 'Content-Type': 'application/json', 'accept': 'application/json' },
            // data: config.data
        };
        if(config.data){
            httpconfig.data = JSON.stringify(config.data)
        }
        if(config.formData){
            httpconfig.headers['Content-Type'] = 'multipart/form-data'
            httpconfig.data = new FormData()
            for (const [key, value] of Object.entries(config.formData)) {
                httpconfig.data.append(key, value);
            }

        }
        axios(httpconfig)
            .then(function (response) {
                // console.log("response",response)
                resolve(response)
            })
            .catch(function (error) {
                // console.log("error",error)
                reject(error)
            });
    })
}

function PUT(config) {
    config.method = 'put'
    return ALL(config)
}
function POST(config) {
    config.method = 'post'
    return ALL(config)
}
function GET(config) {
    config.method = 'get'
    return ALL(config)
}

exports.PUT = PUT
exports.POST = POST
exports.GET = GET
exports.ALL = ALL