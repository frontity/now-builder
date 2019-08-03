# Frontity - Now builder

Use this builder to deploy a [Frontity](https://frontity.org) project in the Zeit Now hosting.

## Before deploying

1. Create this `now.json` file in your project and change the site url:

```json
{
  "alias": "www.your-site.com",
  "builds": [
    {
      "src": "package.json",
      "use": "@frontity/now"
    }
  ]
}
```

2. Create an account on Now. You can [signup here](https://zeit.co/signup).

3. Log in the terminal:

```bash
> npx now login
```

## Deploy a test site

Deploy Frontity using this command:

```bash
> npx now
```

That will give you a unique URL for that deploy. Check that everything is ok.

## Deploy a production site

You need to [add a CNAME](https://zeit.co/docs/v2/custom-domains/#option-2:-using-external-nameservers) of `www.your-site.com` to `alias.zeit.co` in your domain DNS settings.

Then, deploy Frontity using this command:

```bash
> npx now --target production
```

That will createa a deploy and assign it to your real site url.
