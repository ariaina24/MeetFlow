export interface Message {
  text: string;
  time: Date;
  isSent: boolean;
}

export interface GroupedMessage {
  date: string;
  messages: Message[];
}

export interface ApiMessage {
  text: string;
  time: string;
  senderId: { _id: string };
}
