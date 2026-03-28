"use client"

import NewBlogPostClient from "../new/NewBlogPostClient"

type Props = { postId: string }

export default function EditBlogPostClient({ postId }: Props) {
  return <NewBlogPostClient postId={postId} />
}
