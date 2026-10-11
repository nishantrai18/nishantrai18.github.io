#!/usr/bin/env python3
"""Install a pinned, checkout-local Ruby on Apple Silicon without Homebrew.

Ruby comes from the official ruby/ruby-builder release. Shared libraries come
from public Homebrew bottles. Every archive is verified before extraction.
"""
import hashlib
import json
from pathlib import Path
import shutil
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = ROOT / ".local" / "runtime"
RUBY = RUNTIME / "arm64"
DEPENDENCIES = RUNTIME / "dependencies"
RUBY_URL = "https://github.com/ruby/ruby-builder/releases/download/ruby-3.4.11/ruby-3.4.11-darwin-arm64.tar.gz"
RUBY_SHA256 = "0ca8faa222018b9d0652d79dc8dd320016138d06f5634c28ccd05b65fb0f6502"
BOTTLES = {
    "gmp": ("gmp", "3ea4034c547217e84019dada2669c1f2cd4a44a1cf094ad4881ff525713077c5"),
    "openssl@3": ("openssl/3", "0994a8029175af4578c3b93b3020e58dffa638ca21dc22d862c6bc02fea7e73b"),
    "libyaml": ("libyaml", "98c0cf81bcdf7577d5fdc8cc18732970b9ae7e0e7423a733f88f0f566ba483ad"),
}


def download(url, destination, checksum, headers=None):
    request = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(request) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != checksum:
        raise RuntimeError("Archive checksum did not match: " + destination.name)
    destination.write_bytes(data)


def extract(archive, destination):
    with tarfile.open(archive) as bundle:
        for member in bundle.getmembers():
            target = (destination / member.name).resolve()
            if destination.resolve() not in target.parents and target != destination.resolve():
                raise RuntimeError("Archive contains a path outside its destination")
        bundle.extractall(destination)


def main():
    DEPENDENCIES.mkdir(parents=True, exist_ok=True)
    ruby_archive = DEPENDENCIES / "ruby-3.4.11-darwin-arm64.tar.gz"
    download(RUBY_URL, ruby_archive, RUBY_SHA256)
    extract(ruby_archive, RUNTIME)
    for name, (scope, checksum) in BOTTLES.items():
        token_url = "https://ghcr.io/token?service=ghcr.io&scope=repository:homebrew/core/" + scope + ":pull"
        with urllib.request.urlopen(token_url) as response:
            token = json.load(response)["token"]
        url = "https://ghcr.io/v2/homebrew/core/" + scope + "/blobs/sha256:" + checksum
        archive = DEPENDENCIES / (name + ".tar.gz")
        download(url, archive, checksum, {"Authorization": "Bearer " + token})
        extract(archive, DEPENDENCIES)
        for library in DEPENDENCIES.glob(name + "/*/lib/*.dylib"):
            if not library.is_symlink():
                shutil.copy2(library, RUBY / "lib" / library.name)
    print("Installed Ruby 3.4.11 and its libraries in .local/runtime/.")


if __name__ == "__main__":
    main()
