import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, Pressable, Modal, StatusBar, StyleSheet } from 'react-native';

interface Question {
  id: number;
  text: string;
  responses?: { text: string }[];
  isResponded?: boolean;
  isExpanded?: boolean;
}

export default function App() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [responseInput, setResponseInput] = useState<string>('');

  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:8000');
    setSocket(ws);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received data:', data);

      if (data.questions) {
        setQuestions(data.questions);
        setTotalPages(data.total_pages);
      } else if (data.response) {
        setQuestions(prevQuestions =>
          prevQuestions.map(q =>
            q.id === data.question_id ? { ...q, responses: [...(q.responses || []), { text: data.response }], isResponded: true } : q
          )
        );
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = () => {
    if (socket && inputText) {
      const message = JSON.stringify({ question: inputText });
      socket.send(message);
    }
  };

  const sendResponse = () => {
    if (socket && responseInput && selectedQuestion) {
      const message = JSON.stringify({ response: responseInput, question_id: selectedQuestion.id });
      socket.send(message);

      setModalVisible(false);
      setResponseInput('');
    }
  };

  const openModal = (question: Question) => {
    setSelectedQuestion(question);
    setModalVisible(true);
  };

  const toggleExpand = (questionId: number) => {
    setQuestions(prevQuestions =>
      prevQuestions.map(q =>
        q.id === questionId ? { ...q, isExpanded: !q.isExpanded } : q
      )
    );
  };

  const loadPage = (pageNumber: number) => {
    if (socket) {
      const message = JSON.stringify({ page: pageNumber });
      socket.send(message);
      setCurrentPage(pageNumber);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={inputText}
        onChangeText={setInputText}
        placeholder="Escribe tu pregunta"
        multiline
        numberOfLines={4}
      />
      <Button title="Send Question" onPress={sendMessage} />

      <FlatList
        data={questions}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Pressable onPress={() => item.isResponded ? toggleExpand(item.id) : openModal(item)}>
            <View style={[
              styles.questionContainer,
              item.responses?.length ? styles.respondedQuestion : {}
            ]}>
              <Text style={styles.questionItem}>
                {item.text}
              </Text>
              {item.isExpanded && item.responses && (
                <View style={styles.responseContainer}>
                  {item.responses.map((answer, index) => (
                    <Text key={index} style={styles.responseText}>{answer.text}</Text>
                  ))}
                </View>
              )}
            </View>
          </Pressable>
        )}
      />

      <View style={styles.pagination}>
        <Button
          title="Previous"
          onPress={() => currentPage > 1 && loadPage(currentPage - 1)}
          disabled={currentPage === 1}
        />
        <Text>Page {currentPage} of {totalPages}</Text>
        <Button
          title="Next"
          onPress={() => currentPage < totalPages && loadPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        />
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Pressable style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>X</Text>
            </Pressable>
            <Text>Respuesta para: {selectedQuestion?.text}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={responseInput}
              onChangeText={setResponseInput}
              placeholder="Escribe tu respuesta"
              multiline
              numberOfLines={4}
            />
            <Button title="Send Response" onPress={sendResponse} />
          </View>
        </View>
      </Modal>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: 'gray',
    marginBottom: 10,
    padding: 10,
  },
  textArea: {
    height: 100, // Altura del textarea
  },
questionContainer: {
    padding: 15,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
  },
  respondedQuestion: {
    backgroundColor: '#e0f7fa',
  },
  questionItem: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  responseContainer: {
    marginTop: 10,
  },
  responseText: {
    fontSize: 14,
    marginTop: 5,
    paddingLeft: 10,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  closeButton: {
    alignSelf: 'flex-end',
  },
  closeButtonText: {
    fontSize: 18,
    color: 'red',
  },
});
  
