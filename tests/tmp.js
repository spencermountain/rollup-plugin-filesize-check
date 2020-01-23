// This function isn't used anywhere, so
// Rollup excludes it from the bundle...
const square = function(x) {
  return x * x
}

const lyrics = `
What's with these homies, dissing my girl?
Why do they gotta front?
What did we ever do to these guys
That made them so violent?

Woo-hoo, but you know I'm yours
Woo-hoo, and I know you're mine
Woo-hoo, and that's for all of time

Oo-ee-oo I look just like Buddy Holly
Oh-oh, and you're Mary Tyler Moore
I don't care what they say about us anyway
I don't care 'bout that

Don't you ever fear, I'm always near
I know that you need help
Your tongue is twisted, your eyes are slit
You need a guardian

Woo-hoo, and you know I'm yours
Woo-hoo, and I know you're mine
Woo-hoo, and that's for all of time

Oo-ee-oo I look just like Buddy Holly
Oh-oh, and you're Mary Tyler Moore
I don't care what they say about us anyway
I don't care 'bout that
I don't care 'bout that

Bang, bang a knock on the door
Another big bang and you're down on the floor
Oh no! What do we do?
Don't look now but I lost my shoe
I can't run and I can't kick
What's the matter babe are you feeling sick?
What's the matter, what's the matter, what's the matter you?
What's the matter babe, are you feeling blue?

And that's for all of time
And that's for all of time

Oo-ee-oo I look just like Buddy Holly
Oh-oh, and you're Mary Tyler Moore
I don't care what they say about us anyway
I don't care 'bout that
I don't care 'bout that
I don't care 'bout that
I don't care 'bout that `

// This function gets included
const cube = function(x) {
  // rewrite this as `square( x ) * x`
  // and see what happens!
  return x * x * x
}
const doMath = function() {
  let x = 2
  if (lyrics.match('cool')) {
    x = 3
  }
  x = square(x)
  x = cube(x)
  return x
}
module.exports = doMath
