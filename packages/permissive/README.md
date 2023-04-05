# @license-cop/permissive

An out-of-the-box base config file for [license-cop](https://npmjs.com/packages/license-cop) containing a curated list of especially permissive licenses.

## Usage

Install `@license-cop/permissive`

```bash
npm install @license-cop/permissive --save-dev
```

Add it to your own config

```json
{
  "extends": "@license-cop/permissive",
  "licenses": ["anything extra that you need"]
}
```

#### Disclaimer

It is important to remember that each unique license comes with it's own set of constraints. You cannot assume that just because a license is included in this config that it is exactly equal to all the others.

You need to make sure that you adhere to all of the constraints of all of the licenses in all your dependencies.

That being said, all the licenses in this config:

- Allow commercial use of the licensed material
- Allow private use of the licensed material
- Allow you to distribute the licensed material
- Allow you to modify the licensed material

Many of the licenses in this config:

- Require you to distribute a copy of themselves and any copyright notices alongside the licensed material
- Limit the liability of the author of the licensed material
- Explicitly call out a lack of warranty over the licensed material

**None** of the licenses in this config:

- Require you to publish your source code
- Force you to release your work under the same licenses as the licensed material
- Require you to state the changes that you make to the licensed material

## License

[`@license-cop/permissive`](https://npmjs.com/packages/@license-cop/permissive) itself is licensed under the [ISC license](./License.md).
