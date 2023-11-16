const axios = require('axios');
const querystring = require('node:querystring');
function ALL(config) {
    return new Promise((resolve, reject) => {
        config.query = config.query || {}
        config.query_data_defaults = config.query_data_defaults || {}
        if(!config.org_limit) config.org_limit = config.query.limit
        if(config.query.limit > config.max_limit){
            config.query.limit = config.max_limit
        }
        if(config.org_limit > config.query.limit && config.org_limit - (config.res?.length || 0) < config.query.limit){
            config.query.limit = config.org_limit - config.res.length
            
        }
        config.query = {...config.query_data_defaults,...config.query}
        // console.log("config",config)
        let httpconfig = {
            method: config.method,
            url: `${config.base_url}${config.v || config.default_v}${config.path}${config.query ? `?${querystring.stringify(config.query)}` : ''}`,
            headers: { 'Authorization': `${config.auth_prefix || "Bearer"} ${config.key}`, 'Content-Type': 'application/json', 'accept': 'application/json' },
            data: {...config.query,...config.data} || config.query
        };
        // if(config.data){
            // httpconfig.data = JSON.stringify(config.data)
        // }
        if(config.formData){
            httpconfig.headers['Content-Type'] = 'multipart/form-data'
            httpconfig.data = new FormData()
            for (const [key, value] of Object.entries(config.formData)) {
                httpconfig.data.append(key, value);
            }

        }
        axios(httpconfig)
            .then(function (response) {
                if(config.getAll){
                    // console.log("response",response)
                    config.res = config.res || []
                    config.res.push(...config.getDataOnly(response))
                    console.log("config.res.length",config.res.length,"config.org_limit",config.org_limit,"config.query.limit",config.query.limit)
                    if(config.res.length < config.org_limit){
                        if(config.getDataOnly(response).length < config.query.limit){
                            return resolve(config.res)
                        }else
                        if(config.getNext(config,response.data)){
                            config.query.after = config.getNext(config,response.data)
                            return resolve(ALL(config))
                        }
                    }else{
                        // return resolve(config)
                        resolve(config.res)
                    }
                }else{
                    resolve(response)
                }
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