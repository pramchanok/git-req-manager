import { getEmojiChar } from '../../utils/emoji'
export default function EmojiCharacter({ name }: { name: string }) { return <>{getEmojiChar(name)}</> }
