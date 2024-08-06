import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, Pressable, Modal, StatusBar, StyleSheet } from 'react-native';

interface Response {
  text: string;
  id: number;
  responses?: Response[];
}

interface Question {
  id: number;
  text: string;
  responses?: Response[];
  isResponded?: boolean;
  isExpanded?: boolean;
}

export default function App4() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [responseModalVisible, setResponseModalVisible] = useState<boolean>(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [responseInput, setResponseInput] = useState<string>('');
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(null);
  const [responseToResponseInput, setResponseToResponseInput] = useState<string>('');

  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:8000');
    setSocket(ws);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.questions) {
        setQuestions(data.questions);
        setTotalPages(data.total_pages);
      } else if (data.response) {
        setQuestions(prevQuestions =>
          prevQuestions.map(q =>
            q.id === data.question_id ? { 
              ...q, 
              responses: [...(q.responses || []), { text: data.response, id: data.response_id, responses: [] }], 
              isResponded: true 
            } : q
          )
        );
      } else if (data.response_to_response) {
        setQuestions(prevQuestions =>
          prevQuestions.map(q =>
            q.id === data.question_id ? {
              ...q,
              responses: q.responses?.map(r =>
                r.id === data.response_id ? { 
                  ...r, 
                  responses: [...(r.responses || []), { text: data.response_to_response, id: data.response_to_response_id, responses: [] }] 
                } : r
              )
            } : q
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

  const sendResponseToResponse = () => {
    if (socket && responseToResponseInput && selectedResponse && selectedQuestion) {
      const message = JSON.stringify({
        response_to_response: responseToResponseInput,
        question_id: selectedQuestion.id,
        response_id: selectedResponse.id,
        response_to_response_id: Date.now()
      });
      socket.send(message);

      setResponseToResponseInput('');
      setSelectedResponse(null);
      setResponseModalVisible(false);
    }
  };

  const openModal = (question: Question) => {
    setQuestions(prevQuestions =>
      prevQuestions.map(q =>
        q.id === question.id ? { ...q, isExpanded: !q.isExpanded } : q
      )
    );

    if (!question.isExpanded) {
      setSelectedQuestion(question);
      setModalVisible(true);
    }
  };

  const openResponseModal = (response: Response) => {
    setSelectedResponse(response);
    setResponseModalVisible(true);
  };

  const loadPage = (pageNumber: number) => {
    if (socket) {
      const message = JSON.stringify({ page: pageNumber });
      socket.send(message);
      setCurrentPage(pageNumber);
    }
  };

  const renderResponse = ({ item }: { item: Response }) => (
    <View style={styles.responseBlock}>
      <Text style={styles.responseText}>{item.text}</Text>
      <Button
        title="Responder"
        onPress={() => openResponseModal(item)}
      />
      {item.responses?.length > 0 && (
        <FlatList
          data={item.responses}
          keyExtractor={(res) => res.id.toString()}
          renderItem={renderResponse}
        />
      )}
    </View>
  );

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
          <Pressable onPress={() => openModal(item)}>
            <View style={[
              styles.questionContainer,
              item.isResponded ? styles.respondedQuestion : {},
              item.responses?.length ? styles.hasResponses : {}
            ]}>
              <Text style={styles.questionItem}>{item.text}</Text>
              {item.isExpanded && item.responses && (
                <View style={styles.responseContainer}>
                  <FlatList
                    data={item.responses}
                    keyExtractor={(response) => response.id.toString()}
                    renderItem={renderResponse}
                  />
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

      <Modal
        visible={responseModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setResponseModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Pressable style={styles.closeButton} onPress={() => setResponseModalVisible(false)}>
              <Text style={styles.closeButtonText}>X</Text>
            </Pressable>
            <Text>Respuesta para: {selectedResponse?.text}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={responseToResponseInput}
              onChangeText={setResponseToResponseInput}
              placeholder="Escribe tu respuesta"
              multiline
              numberOfLines={4}
            />
            <Button title="Send Response" onPress={sendResponseToResponse} />
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
    height: 100,
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
  hasResponses: {
    backgroundColor: '#e8f5e9'
  },
  responseBlock: {
    padding: 10,
    backgroundColor: '#f1f1f1',
    borderRadius: 5,
    marginBottom: 5,
  },
  responseText: {
    marginBottom: 5,
  },
  questionItem: {
    fontSize: 18,
  },
  responseContainer: {
      marginTop: 10,
    },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: 10,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      },
      modalContent: {
        width: '80%',
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        alignItems: 'center',
      },
      closeButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#ddd',
        borderRadius: 20,
        padding: 5,
      },
      closeButtonText: {
        fontSize: 20,
      },
    });
    
