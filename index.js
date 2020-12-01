import Router from './router'

var twitterRequestHeaders = new Headers()
twitterRequestHeaders.append('Authorization', 'Bearer ' + TWITTER_BEARER)

var requestOptions = {
    method: 'GET',
    headers: twitterRequestHeaders,
    redirect: 'follow',
}

const init = {
    headers: { 'content-type': 'application/json' },
}

async function handleUserDataRequest(request) {
    // parse URL for tweetID
    try {
        const url = new URL(request.url)
        let handle = url.searchParams.get('handle')

        const twitterURL = `https://api.twitter.com/2/users/by/username/${handle}?expansions=pinned_tweet_id&&tweet.fields=author_id&user.fields=profile_image_url`

        // get tweet data from twitter api
        requestOptions.headers.set('Origin', new URL(twitterURL).origin)
        const twitterRespose = await fetch(twitterURL, requestOptions)
        const formattedData = JSON.stringify(await twitterRespose.json())

        // parse the response
        const response = new Response(formattedData, init)
        response.headers.set('Access-Control-Allow-Origin', '*')
        response.headers.append('Vary', 'Origin')
        return response
    } catch {
        // unknown error
        return new Response(null, init, {
            status: 400,
            statusText: 'Error fetching profile',
        })
    }
}

async function handleLatestTweetRequest(request) {
    // parse URL for tweetID
    const url = new URL(request.url)
    let handle = url.searchParams.get('handle')

    try {
        // get the latest tweet from the user and extract the twitter id
        const latestTweetURL = `https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=${handle}&count=1&exclude_replies=true&tweet_mode=extended`
        requestOptions.headers.set('Origin', new URL(latestTweetURL).origin)
        const resLatestTweet = await fetch(latestTweetURL, requestOptions)
        const formattedResponse = JSON.stringify(await resLatestTweet.json())
        const extractedTweetID = JSON.parse(formattedResponse)[0].id_str

        // based on this id make another request to get full text from tweet
        const fullTweetURL = `https://api.twitter.com/2/tweets?ids=${extractedTweetID}`
        requestOptions.headers.set('Origin', new URL(fullTweetURL).origin)
        const resFullTweet = await fetch(fullTweetURL, requestOptions)
        const formattedTweetData = JSON.stringify(await resFullTweet.json())

        // return the results with proper cors headers
        const response = new Response(formattedTweetData, init)
        response.headers.set('Access-Control-Allow-Origin', '*')
        response.headers.append('Vary', 'Origin')
        return response
    } catch {
        // unknown error
        return new Response(null, init, {
            status: 400,
            statusText: 'Error fetching latest tweet',
        })
    }
}

function handleOptions(request) {
    let headers = request.headers
    if (
        headers.get('Origin') !== null &&
        headers.get('Access-Control-Request-Method') !== null &&
        headers.get('Access-Control-Request-Headers') !== null
    ) {
        let respHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
            'Access-Control-Max-Age': '86400',
            'Access-Control-Allow-Headers': request.headers.get(
                'Access-Control-Request-Headers'
            ),
        }
        return new Response(null, {
            headers: respHeaders,
        })
    } else {
        return new Response(null, {
            headers: {
                Allow: 'GET, HEAD, POST, OPTIONS',
            },
        })
    }
}

async function handleRequest(request) {
    const r = new Router()
    r.get('/user', request => handleUserDataRequest(request))
    r.get('/latest-tweet', request => handleLatestTweetRequest(request))
    r.get('/', () => new Response('Invalid route')) // return a default message for the root route

    const resp = await r.route(request)
    return resp
}

/**
 * Example of how router can be used in an application
 *  */
addEventListener('fetch', event => {
    const request = event.request
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') {
        // Handle CORS preflight requests
        event.respondWith(handleOptions(request))
    } else if (
        request.method === 'GET' ||
        request.method === 'HEAD' ||
        request.method === 'POST'
    ) {
        // Handle requests to the API server
        event.respondWith(handleRequest(request))
    } else {
        event.respondWith(
            new Response(null, {
                status: 405,
                statusText: 'Method Not Allowed',
            })
        )
    }
})
