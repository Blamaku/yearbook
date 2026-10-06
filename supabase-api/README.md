# GLUK Yearbook — secure API (Supabase Edge Function `api`)

Every change to your data goes through this function. It checks the person's Firebase login,
decides whether they may do what they asked (profile owner / club official / admin), validates the
data, and only then writes to the database.

## Set it up (about 5 minutes, no card needed)

1. Supabase Dashboard → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly **`api`**.
3. Delete the sample code, paste in the whole of `index.ts`, click **Deploy**.
4. Leave **Verify JWT** switched on. (Your website sends the public key with every request, which
   satisfies it. If you ever see "Invalid JWT", switch Verify JWT off for this function.)

## Check that it works

On your live website (any page), press F12 → **Console**, paste this and press Enter:

    fetch(SUPABASE_URL + '/functions/v1/api', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }, body: '{"action":"ping"}' }).then(r => r.json()).then(console.log)

You should see `{ ok: true, service: "gluk-api", version: 1, keys: "ok" }`.
`keys: "error"` means the function could not reach Google's sign-in keys — tell me and I'll adjust.

After you deploy the updated website, **Admin → Home → Security** shows "Secure service connected".

## Settings

Change these at the top of `index.ts` and deploy again: the Firebase project id, the admin email, and the
list of websites allowed to call the function (add your own domain if you get one).

## Roll back

Nothing here locks your database. Until the separate lockdown step, the website falls back to the old
direct writes if this function cannot be reached. To switch the function off, delete it in the dashboard.
