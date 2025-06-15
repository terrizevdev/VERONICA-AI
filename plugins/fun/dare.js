import fetch from 'node-fetch'
let handler  = async (m, { conn, usedPrefix, command }) => {
    let shizokeys = 'shizo'        
  let res = await fetch(`https://api.shizo.top/api/quote/dare?apikey=${shizokeys}`)
  if (!res.ok) throw await res.text()
            let json = await res.json()
  let shizodevs = `${json.result}`
  dualButtons(conn, m, shizodevs, copyright, "Dare ✊️", `${usedPrefix}${command}`, "Truth 💯", `${usedPrefix}truth`)
}
handler.help = ['dare']
handler.tags = ['fun']
handler.command = /^(dare|deare)$/i

export default handler
