# dev server

To enable `http2` on the dev server,
you'll need to generate a self-signed certificate and private key,
because browsers require a secure `https` connection for `http2`.
To generate the cert:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' \
  -keyout localhost-privkey.pem -out localhost-cert.pem
```

or the builtin task:

```bash
gro project/cert
```

Gro will automatically see the certs created from the above:

```
$root/localhost-cert.pem
$root/localhost-privkey.pem
```

To ignore them in git, you can add this to `.gitignore`:

```
*.pem
```

> TODO document the options

> TODO config?
