declare module '@tryghost/content-api' {
  export interface GhostContentAPIOptions {
    url: string;
    key: string;
    version: string;
  }

  export interface PostsAPI {
    browse(options?: object): Promise<any[]>;
    read(options?: object): Promise<any>;
  }

  export interface GhostAPI {
    posts: PostsAPI;
  }

  export default class GhostContentAPI {
    constructor(options: GhostContentAPIOptions);
    posts: PostsAPI;
  }
} 